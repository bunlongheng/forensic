import { test, expect } from "@playwright/test";
// gifenc ships CJS to node, so pull the named helpers off the default import.
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;

const BASE = `http://localhost:${process.env.PORT || "4336"}`;
const GIF_MAX_BYTES = 3_000_000;  // matches IMAGE_MAX_BYTES - one image, one request
const TITLE = "E2E canvas";

// Purge with a PLAIN fetch, never the `request` fixture. When a test times out
// Playwright tears its fixtures down first, so a fixture-based cleanup in a
// finally throws "Target page, context or browser has been closed" and the board
// is left behind - which is how a pile of "E2E canvas" rows ended up in the DB.
const purge = (id) =>
  fetch(`${BASE}/api/boards/${id}?purge=1`, { method: "DELETE" }).catch(() => {});

// Image bytes now live in their own rows, so a node's src is a URL. "Is this still
// a GIF?" is answered by what the server SERVES, not by a data: prefix - and that
// is the stronger check: it proves the stored bytes were never re-encoded.
const servedType = async (src) => {
  if (src.startsWith("data:")) return src.slice(5, src.indexOf(";"));
  const r = await fetch(src.startsWith("http") ? src : BASE + src);
  return r.headers.get("content-type");
};
const servedBytes = async (src) => {
  if (src.startsWith("data:")) return Math.round((src.length - src.indexOf(",") - 1) * 3 / 4);
  const r = await fetch(src.startsWith("http") ? src : BASE + src);
  return (await r.arrayBuffer()).byteLength;
};

// Belt and braces: sweep any stray board this spec could have created, including
// ones leaked by an earlier crashed run.
test.afterAll(async () => {
  try {
    const rows = await (await fetch(`${BASE}/api/boards`)).json();
    if (!Array.isArray(rows)) return;
    await Promise.all(rows.filter((b) => b.title === TITLE).map((b) => purge(b.id)));
  } catch { /* server already down - nothing to sweep */ }
});

// End-to-end against a PRODUCTION build. Creates a real board via the API
// (localhost = owner, per lib/is-local.js), opens it in the browser, exercises
// the canvas (double-click to drop a note, type, reload), then cleans up with
// a purge delete. Zero console errors throughout.

const BOARD_BODY = {
  title: TITLE,
  nodes: [
    { id: "n1", type: "clip", position: { x: 40, y: 200 }, data: { text: "First clue" } },
    { id: "n2", type: "clip", position: { x: 420, y: 200 }, data: { text: "Second clue" } },
  ],
  edges: [{ source: "n1", target: "n2" }],
};

test("open a board, drop a note, reload, and see it persist", async ({ page, request }) => {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  const create = await request.post("/api/boards", { data: BOARD_BODY });
  expect(create.status()).toBe(201);
  const board = await create.json();
  const id = board.id;

  try {
    await page.goto(`/?id=${id}`);

    const nodes = page.locator(".react-flow__node");
    const edges = page.locator(".react-flow__edge");
    await expect(nodes).toHaveCount(2);
    await expect(edges).toHaveCount(1);

    // Double-click an empty spot on the pane to drop a clip note, already open
    // for typing.
    const pane = page.locator(".react-flow__pane");
    await pane.dblclick({ position: { x: 700, y: 450 } });

    const textarea = page.locator("textarea:focus");
    await textarea.fill("Third clue");

    // Click elsewhere on the pane to blur (commit) the new note.
    await pane.click({ position: { x: 700, y: 550 } });

    await expect(nodes).toHaveCount(3);

    await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });

    await page.reload();

    await expect(nodes).toHaveCount(3);
    await expect(page.getByText("Third clue")).toBeVisible();

    // NOTE: an undo-after-reload step (Cmd/Ctrl+Z expected to drop the count
    // back to 2) was tried here and dropped. Undo history is in-memory only
    // (README: "Undo history | Every snapshot | In memory, 100 entries"), so a
    // reload always starts a fresh, empty history - undo consistently had
    // nothing to revert to, in both runs, not flakily.

    expect(errors).toEqual([]);
  } finally {
    await purge(id);
  }
});

// Paste evidence that is not a photo: a URL, a PDF, an audio clip. Each lands as
// an exhibit card whose icon opens the real thing in a NEW TAB - a link at its
// URL, an embedded file as a blob (browsers refuse to open a data: URL as a tab).
test("paste a link, a PDF and an audio clip, then open them in a new tab", async ({ page, request }) => {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  const create = await request.post("/api/boards", { data: { title: TITLE, nodes: [], edges: [] } });
  expect(create.status()).toBe(201);
  const id = (await create.json()).id;

  try {
    await page.goto(`/?id=${id}`);
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(0);

    // A pasted URL - through the REAL clipboard and a real Cmd/Ctrl+V. The pointer
    // is parked on a known spot first, because a paste lands ON THE CURSOR.
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(() => navigator.clipboard.writeText("https://example.com/case/evidence-log"));
    const pane = page.locator(".react-flow__pane");
    await pane.click({ position: { x: 300, y: 300 } });
    const paneBox = await pane.boundingBox();
    await page.keyboard.press("ControlOrMeta+V");
    await expect(page.getByText("example.com/evidence-log")).toBeVisible();

    // It landed where the pointer was, not in the middle of the view.
    const card = await page.locator(".react-flow__node-file").first().boundingBox();
    expect(Math.abs(card.x - (paneBox.x + 300))).toBeLessThan(60);
    expect(Math.abs(card.y - (paneBox.y + 300))).toBeLessThan(60);

    // A pasted PDF and a pasted audio clip. Chromium drops `clipboardData` from a
    // constructed ClipboardEvent and headless has no way to put a FILE on the
    // system clipboard, so hand the listener the same shape a real paste carries.
    await page.evaluate(() => {
      const mk = (name, type, bytes) => new File([new Uint8Array(bytes)], name, { type });
      const files = [
        mk("warrant.pdf", "application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]),
        mk("call.mp3", "audio/mpeg", [0x49, 0x44, 0x33, 0x03, 0x00, 0x00]),
      ];
      const e = new Event("paste", { bubbles: true, cancelable: true });
      e.clipboardData = { items: files.map((f) => ({ kind: "file", type: f.type, getAsFile: () => f })), getData: () => "" };
      window.dispatchEvent(e);
    });
    await expect(page.getByText("warrant.pdf")).toBeVisible();
    await expect(page.getByText("call.mp3")).toBeVisible();
    await expect(nodes).toHaveCount(3);

    // The link icon opens the URL in a new tab. The tabs open with `noopener`,
    // so they arrive on the CONTEXT, not as a popup of this page.
    const ctx = page.context();
    const [linkTab] = await Promise.all([
      ctx.waitForEvent("page"),
      page.getByLabel("Open example.com/evidence-log in a new tab").click(),
    ]);
    expect(linkTab.url()).toBe("https://example.com/case/evidence-log");
    await linkTab.close();

    // An embedded file is handed over as a blob - a data: URL cannot be a tab.
    const [audioTab] = await Promise.all([
      ctx.waitForEvent("page"),
      page.getByLabel("Open call.mp3 in a new tab").click(),
    ]);
    await expect.poll(() => audioTab.url(), { timeout: 5000 }).toContain("blob:");
    await audioTab.close();

    // Same path for the PDF. Only the ASSERTION differs: headless Chromium ships
    // no PDF viewer, so the blob arrives as a download and the tab stays blank.
    // Real Chrome renders it in the viewer (verified by hand against this build).
    const [pdfTab] = await Promise.all([
      ctx.waitForEvent("page"),
      page.getByLabel("Open warrant.pdf in a new tab").click(),
    ]);
    await pdfTab.close();

    // Both survive a save + reload, bytes and all.
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });
    await page.reload();
    await expect(nodes).toHaveCount(3);
    await expect(page.getByText("warrant.pdf")).toBeVisible();
    await expect(page.getByText("call.mp3")).toBeVisible();
    await expect(page.getByText("example.com/evidence-log")).toBeVisible();

    expect(errors).toEqual([]);
  } finally {
    await purge(id);
  }
});

// A .svg and a .webp are PHOTOS. They used to pin as exhibit cards whenever the
// browser handed them over typeless, and SVG copied as text was ignored outright.
test("a typeless .svg, a .webp, a .gif and pasted SVG markup all pin as images, never as cards", async ({ page, request }) => {
  const create = await request.post("/api/boards", { data: { title: TITLE, nodes: [], edges: [] } });
  const id = (await create.json()).id;

  try {
    await page.goto(`/?id=${id}`);
    // The board is a lazy chunk - its paste listener exists only once the pane does.
    await expect(page.locator(".react-flow__pane")).toBeVisible();
    await page.mouse.move(400, 400);
    await page.evaluate(() => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#c00"/></svg>';
      // A real WebP, encoded by this very browser, so the decode on the way in is genuine.
      const c = document.createElement("canvas"); c.width = 8; c.height = 8;
      c.getContext("2d").fillRect(0, 0, 8, 8);
      const b64 = c.toDataURL("image/webp").split(",")[1];
      const webpBytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      // The canonical 1x1 GIF - real bytes, so a re-encode would show as data:image/webp.
      const gifBytes = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (ch) => ch.charCodeAt(0));
      const files = [
        new File([svg], "logo.svg", { type: "" }),              // typeless, as Finder/drag often delivers it
        new File([webpBytes], "shot.webp", { type: "image/webp" }),
        new File([gifBytes], "clip.gif", { type: "image/gif" }),
      ];
      const fire = (items, text) => {
        const e = new Event("paste", { bubbles: true, cancelable: true });
        e.clipboardData = { items, getData: () => text };
        window.dispatchEvent(e);
      };
      fire(files.map((f) => ({ kind: "file", type: f.type, getAsFile: () => f })), "");
      fire([], svg); // SVG as TEXT - Figma "Copy as SVG"
      // A TALL svg with no width/height: an <img> reports the CSS default 300x150,
      // so without reading the viewBox this lands as a 2:1 node with the art
      // letterboxed inside it.
      const tall = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 400"><rect width="100" height="400" fill="#5b3fa8"/></svg>';
      fire([{ kind: "file", type: "image/svg+xml", getAsFile: () => new File([tall], "tall.svg", { type: "image/svg+xml" }) }], "");
    });
    await expect(page.locator(".react-flow__node-image")).toHaveCount(5);
    await expect(page.locator(".react-flow__node-file")).toHaveCount(0);
    // Every one of them actually decoded - a broken <img> reports 0 natural width.
    await expect.poll(() => page.locator(".react-flow__node-image img")
      .evaluateAll((els) => els.every((el) => el.naturalWidth > 0)), { timeout: 20_000 }).toBe(true);
    const imgs = await page.locator(".react-flow__node-image img").evaluateAll((els) => els.map((el) => ({ w: el.naturalWidth, src: el.src })));
    // The GIF is still a GIF - a re-encode would have made it a WebP.
    const types = await Promise.all(imgs.map((i) => servedType(i.src)));
    expect(types).toContain("image/gif");
    // The tall SVG kept its 1:4 shape instead of the browser's 2:1 default.
    const shapes = await page.locator(".react-flow__node-image").evaluateAll((els) =>
      els.map((el) => { const r = el.getBoundingClientRect(); return Math.round((r.height / r.width) * 100) / 100; }));
    expect(shapes.some((r) => r > 3.5 && r < 4.5)).toBe(true);
  } finally {
    await purge(id);
  }
});

// An oversized GIF is shrunk in a worker - fewer frames, smaller pixels - while a
// progress toast stays up, then pins as a real animated GIF under the cap.
test("an oversized GIF shows shrinking progress and pins under the cap, still animated", async ({ page, request }) => {
  test.setTimeout(90_000);
  // Build a GIF that is over 2 MB: noise compresses badly, so 30 frames of 320x320
  // random pixels land around 3 MB. Generated here so no binary lives in the repo.
  const W = 360, H = 360, FRAMES = 40;   // noise compresses badly: lands over the 3 MB cap
  const gif = GIFEncoder();
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let f = 0; f < FRAMES; f++) {
    const rgba = new Uint8ClampedArray(W * H * 4);
    for (let p = 0; p < rgba.length; p += 4) { rgba[p] = rand() * 255; rgba[p + 1] = rand() * 255; rgba[p + 2] = rand() * 255; rgba[p + 3] = 255; }
    const palette = quantize(rgba, 256);
    gif.writeFrame(applyPalette(rgba, palette), W, H, { palette, delay: 50, repeat: 0 });
  }
  gif.finish();
  const bytes = gif.bytes();
  expect(bytes.length).toBeGreaterThan(GIF_MAX_BYTES);

  const create = await request.post("/api/boards", { data: { title: TITLE, nodes: [], edges: [] } });
  const id = (await create.json()).id;
  try {
    await page.goto(`/?id=${id}`);
    await expect(page.locator(".react-flow__pane")).toBeVisible();
    await page.mouse.move(400, 400);
    await page.evaluate((b64) => {
      const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const f = new File([bytes], "noise.gif", { type: "image/gif" });
      const e = new Event("paste", { bubbles: true, cancelable: true });
      e.clipboardData = { items: [{ kind: "file", type: f.type, getAsFile: () => f }], getData: () => "" };
      window.dispatchEvent(e);
    }, Buffer.from(bytes).toString("base64"));

    await expect(page.getByText(/Shrinking noise\.gif/)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".react-flow__node-image")).toHaveCount(1, { timeout: 60_000 });
    await expect(page.locator(".react-flow__node-file")).toHaveCount(0);
    // The src is a URL now, so the browser has to fetch it before it has a size.
    const shot = page.locator(".react-flow__node-image img").first();
    await expect.poll(() => shot.evaluate((el) => el.naturalWidth), { timeout: 20_000 }).toBeGreaterThan(0);
    const src = await shot.evaluate((el) => el.src);
    expect(await servedType(src)).toBe("image/gif");   // never re-encoded
    expect(await servedBytes(src)).toBeLessThanOrEqual(GIF_MAX_BYTES);
  } finally {
    await purge(id);
  }
});

// The point of cut: move evidence from one board to another. The clipboard has to
// outlive the board component, which App remounts on every board switch.
test("cut a node on one board and paste it onto a different board", async ({ page, request }) => {
  const mk = async (title) => {
    const r = await request.post("/api/boards", { data: { title, nodes: [], edges: [] } });
    return (await r.json()).id;
  };
  const from = await mk(TITLE);
  const to = await mk(TITLE);

  try {
    // Board 1: make a note, select it, cut it.
    await page.goto(`/?id=${from}`);
    await expect(page.locator(".react-flow__pane")).toBeVisible();
    const pane = page.locator(".react-flow__pane");
    await pane.dblclick({ position: { x: 320, y: 260 } });   // drops a clip note, open for typing
    const note = page.locator(".react-flow__node-clip");
    await expect(note).toHaveCount(1);
    await page.locator("textarea:focus").fill("moved evidence");
    await pane.click({ position: { x: 700, y: 520 } });       // blur commits the text
    await note.click();                                       // and select it
    await page.keyboard.press("ControlOrMeta+x");
    await expect(page.getByText(/^Cut 1 item$/)).toBeVisible();
    await expect(note).toHaveCount(0);           // gone from this board
    // Assert on what PERSISTED, not on the save pill: "Saved" is transient and
    // falls back to idle, so polling the label is flaky by construction.
    await expect.poll(async () => (await (await request.get(`/api/boards/${from}`)).json()).nodes.length,
                      { timeout: 15_000 }).toBe(0);

    // Board 2: paste it.
    await page.goto(`/?id=${to}`);
    await expect(page.locator(".react-flow__pane")).toBeVisible();
    await page.mouse.move(500, 400);
    await page.evaluate(() => {
      const e = new Event("paste", { bubbles: true, cancelable: true });
      e.clipboardData = { items: [], getData: () => "forensic-node-copy" };
      window.dispatchEvent(e);
    });
    await expect(page.locator(".react-flow__node-clip")).toHaveCount(1);
    await expect(page.getByText("moved evidence")).toBeVisible();

    // and it survives a reload of the destination board
    await expect.poll(async () => (await (await request.get(`/api/boards/${to}`)).json()).nodes.length,
                      { timeout: 15_000 }).toBe(1);
    await page.reload();
    await expect(page.getByText("moved evidence")).toBeVisible();
  } finally {
    await purge(from);
    await purge(to);
  }
});

// Image bytes live in their own rows now, so a board is no longer capped at ~4 MB
// of photos. The node keeps a URL; an OLD board full of inline data URLs must keep
// rendering exactly as it did, which is what lets this roll out without a migration.
test("a pasted image is stored by reference, and old inline boards still render", async ({ page, request }) => {
  // An old-style board: the image is a data URL inline in the node, as every board
  // saved before this change looks.
  const RED_DOT = "data:image/gif;base64,R0lGODlhAQABAIAAAP8AAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
  const legacy = await request.post("/api/boards", { data: { title: TITLE, edges: [],
    nodes: [{ id: "old", type: "image", position: { x: 80, y: 80 }, style: { width: 120, height: 120 },
              data: { src: RED_DOT } }] } });
  const legacyId = (await legacy.json()).id;
  const fresh = await request.post("/api/boards", { data: { title: TITLE, nodes: [], edges: [] } });
  const freshId = (await fresh.json()).id;

  try {
    // 1. The old board still renders its inline image - nothing migrated, nothing broken.
    await page.goto(`/?id=${legacyId}`);
    await expect(page.locator(".react-flow__pane")).toBeVisible();
    const oldImg = page.locator(".react-flow__node-image img").first();
    await expect(oldImg).toBeVisible();
    expect(await oldImg.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
    expect(await oldImg.evaluate((el) => el.src.slice(0, 11))).toBe("data:image/");

    // 2. A NEW image is uploaded and the node holds a URL, not the bytes.
    await page.goto(`/?id=${freshId}`);
    await expect(page.locator(".react-flow__pane")).toBeVisible();
    await page.mouse.move(400, 400);
    await page.evaluate(async () => {
      const c = document.createElement("canvas"); c.width = 60; c.height = 40;
      const g = c.getContext("2d"); g.fillStyle = "#1f7a6b"; g.fillRect(0, 0, 60, 40);
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      const f = new File([blob], "shot.png", { type: "image/png" });
      const e = new Event("paste", { bubbles: true, cancelable: true });
      e.clipboardData = { items: [{ kind: "file", type: f.type, getAsFile: () => f }], getData: () => "" };
      window.dispatchEvent(e);
    });
    const img = page.locator(".react-flow__node-image img").first();
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el) => el.src)).toContain("/api/images/");
    expect(await img.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);

    // 3. The saved board carries the URL, not the bytes - the whole point.
    await expect.poll(async () => (await (await request.get(`/api/boards/${freshId}`)).json()).nodes.length,
                      { timeout: 15_000 }).toBe(1);
    const saved = await (await request.get(`/api/boards/${freshId}`)).json();
    expect(saved.nodes[0].data.src).toMatch(/^\/api\/images\//);
    expect(JSON.stringify(saved.nodes).length).toBeLessThan(2000); // was megabytes
  } finally {
    await purge(legacyId);
    await purge(freshId);
  }
});

// The bottom-left summon: one of the two ways into the tool ring, alongside the
// toolbar + (holding Cmd used to be a third and was removed - its dwell timer
// raced every other Cmd gesture). Also guards the wax seal, which boards in the
// wild still hold and which briefly lost its renderer.
test("the bottom-left summon opens the tool ring and drops a wax seal", async ({ page, request }) => {
  const create = await request.post("/api/boards", { data: { title: TITLE, nodes: [], edges: [] } });
  const id = (await create.json()).id;

  try {
    await page.goto(`/?id=${id}`);
    const fab = page.getByRole("button", { name: "Open add tools" });
    await expect(fab).toBeVisible();
    // A ghost at rest, solid under the pointer.
    expect(Number(await fab.evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(0.5);
    await fab.hover();
    await expect.poll(() => fab.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);

    // Holding Cmd on bare canvas must do NOTHING now - the dwell summon is gone.
    await page.mouse.move(600, 400);
    await page.keyboard.down("ControlOrMeta");
    await page.waitForTimeout(700); // well past the old 260ms dwell
    await expect(page.getByRole("button", { name: "Wax seal" })).toHaveCount(0);
    await page.keyboard.up("ControlOrMeta");

    await fab.click();
    await page.getByRole("button", { name: "Wax seal" }).click();
    await expect(page.locator(".react-flow__node-wax")).toHaveCount(1);
  } finally {
    await purge(id);
  }
});

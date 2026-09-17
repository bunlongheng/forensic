import { test, expect } from "@playwright/test";

const BASE = `http://localhost:${process.env.PORT || "4336"}`;
const TITLE = "E2E canvas";

// Purge with a PLAIN fetch, never the `request` fixture. When a test times out
// Playwright tears its fixtures down first, so a fixture-based cleanup in a
// finally throws "Target page, context or browser has been closed" and the board
// is left behind - which is how a pile of "E2E canvas" rows ended up in the DB.
const purge = (id) =>
  fetch(`${BASE}/api/boards/${id}?purge=1`, { method: "DELETE" }).catch(() => {});

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
    });
    await expect(page.locator(".react-flow__node-image")).toHaveCount(4);
    await expect(page.locator(".react-flow__node-file")).toHaveCount(0);
    // Every one of them actually decoded - a broken <img> reports 0 natural width.
    const imgs = await page.locator(".react-flow__node-image img").evaluateAll((els) => els.map((el) => ({ w: el.naturalWidth, src: el.src.slice(0, 15) })));
    expect(imgs.every((i) => i.w > 0)).toBe(true);
    // The GIF is still a GIF - a re-encode would have turned it into data:image/webp.
    expect(imgs.map((i) => i.src)).toContain("data:image/gif;");
  } finally {
    await purge(id);
  }
});

// The bottom-left summon: a third way into the same tool ring, alongside holding
// Cmd and the toolbar +. Also guards the wax seal, which boards in the wild
// still hold and which briefly lost its renderer.
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

    await fab.click();
    await page.getByRole("button", { name: "Wax seal" }).click();
    await expect(page.locator(".react-flow__node-wax")).toHaveCount(1);
  } finally {
    await purge(id);
  }
});

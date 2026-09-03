import { test, expect } from "@playwright/test";

// End-to-end against a PRODUCTION build. Creates a real board via the API
// (localhost = owner, per lib/is-local.js), opens it in the browser, exercises
// the canvas (double-click to drop a note, type, reload), then cleans up with
// a purge delete. Zero console errors throughout.

const BOARD_BODY = {
  title: "E2E canvas",
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
    await request.delete(`/api/boards/${id}?purge=1`);
  }
});

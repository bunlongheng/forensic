// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { saveDraft, loadDraft, clearDraft } from "../../src/lib/localBoard.js";

describe("localBoard drafts (IndexedDB)", () => {
  it("round-trips a draft through save/load", async () => {
    const draft = { snapshot: '{"nodes":[],"edges":[]}', ts: 12345 };
    await saveDraft("board-1", draft);
    const loaded = await loadDraft("board-1");
    expect(loaded).toEqual(draft);
  });

  it("clearDraft then loadDraft resolves nothing", async () => {
    await saveDraft("board-2", { snapshot: "x", ts: 1 });
    await clearDraft("board-2");
    const loaded = await loadDraft("board-2");
    // IndexedDB.get on a missing key completes successfully with an undefined
    // result (not an error), so loadDraft's .catch(() => null) never fires here.
    expect(loaded == null).toBe(true);
  });

  it("loadDraft of an unknown id resolves nothing", async () => {
    const loaded = await loadDraft("never-saved-id");
    expect(loaded == null).toBe(true);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

vi.mock("../../src/lib/api.js", () => ({ updateBoard: vi.fn() }));
vi.mock("../../src/lib/localBoard.js", () => ({ saveDraft: vi.fn(), loadDraft: vi.fn(), clearDraft: vi.fn() }));

import { updateBoard } from "../../src/lib/api.js";
import { saveDraft, loadDraft, clearDraft } from "../../src/lib/localBoard.js";
import { useBoardPersistence } from "../../src/hooks/useBoardPersistence.js";
import { boardSnapshot } from "../../src/lib/boardGraph.js";

const board = { id: "b1", title: "Case", nodes: [{ id: "n", type: "note", position: { x: 0, y: 0 }, data: {} }], edges: [] };
const snap0 = boardSnapshot(board);
const snap1 = boardSnapshot({ ...board, title: "Case 2" });

function setup(props = {}) {
  const restore = vi.fn(), fitView = vi.fn(), showToast = vi.fn(), makeThumb = vi.fn().mockResolvedValue("thumb-data");
  const hook = renderHook(
    ({ snapshot, canEdit, makeThumb: mt }) => useBoardPersistence({ board, canEdit, snapshot, restore, fitView, showToast, makeThumb: mt }),
    { initialProps: { snapshot: snap0, canEdit: true, makeThumb, ...props } },
  );
  return { restore, fitView, showToast, makeThumb, ...hook };
}

beforeEach(() => {
  vi.useFakeTimers();
  updateBoard.mockResolvedValue({});
  loadDraft.mockResolvedValue(null);
  vi.stubGlobal("requestAnimationFrame", (cb) => cb());
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("useBoardPersistence", () => {
  it("never saves on the initial load, then debounces a real change to the server", async () => {
    const { result, rerender } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(updateBoard).not.toHaveBeenCalled();
    expect(result.current.save).toBe("idle");

    rerender({ snapshot: snap1, canEdit: true });
    expect(result.current.save).toBe("saving");
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(updateBoard).toHaveBeenCalledWith("b1", JSON.parse(snap1));
    expect(clearDraft).toHaveBeenCalledWith("b1");
    expect(result.current.save).toBe("saved");
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(result.current.save).toBe("idle");
  });

  it("mirrors changes to the local draft once restore has run, ahead of the server save", async () => {
    const { rerender } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // restore-on-open settles
    rerender({ snapshot: snap1, canEdit: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(saveDraft).toHaveBeenCalledWith("b1", expect.objectContaining({ snapshot: snap1 }));
    expect(updateBoard).not.toHaveBeenCalled();
  });

  it("reports an offline error and retries when the connection returns", async () => {
    updateBoard.mockRejectedValueOnce(new Error("offline"));
    const { result, rerender } = setup();
    rerender({ snapshot: snap1, canEdit: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(result.current.save).toBe("error");

    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(updateBoard).toHaveBeenCalledTimes(2);
    expect(result.current.save).toBe("saved");
  });

  it("Cmd+S saves immediately and toasts", async () => {
    const { rerender, showToast } = setup();
    rerender({ snapshot: snap1, canEdit: true });
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true })); });
    expect(updateBoard).toHaveBeenCalledWith("b1", JSON.parse(snap1));
    expect(showToast).toHaveBeenCalledWith("Board saved");
  });

  it("restores an unsynced local draft on open and frames the board", async () => {
    loadDraft.mockResolvedValueOnce({ snapshot: snap1, ts: 1 });
    const { restore, fitView, showToast } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(restore).toHaveBeenCalledWith(JSON.parse(snap1));
    expect(showToast).toHaveBeenCalledWith("Restored your unsaved changes");
    expect(fitView).toHaveBeenCalled();
  });

  it("ignores a draft identical to the server copy and a corrupt one", async () => {
    loadDraft.mockResolvedValueOnce({ snapshot: snap0 });
    const a = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(a.restore).not.toHaveBeenCalled();
    cleanup();
    loadDraft.mockResolvedValueOnce({ snapshot: "{not json" });
    const b = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(b.restore).not.toHaveBeenCalled();
    expect(b.fitView).toHaveBeenCalled(); // server copy has content
  });

  it("does nothing for a read-only viewer", async () => {
    const { rerender } = setup({ canEdit: false });
    rerender({ snapshot: snap1, canEdit: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(updateBoard).not.toHaveBeenCalled();
    expect(saveDraft).not.toHaveBeenCalled();
    expect(loadDraft).not.toHaveBeenCalled();
  });

  it("refuses an oversized snapshot without calling updateBoard", async () => {
    const { result, rerender } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // restore-on-open settles
    // The guard measures the same thing the server does: the nodes JSON, 4 MB.
    const huge = JSON.stringify({ title: "big", nodes: [{ id: "n", type: "image", position: { x: 0, y: 0 }, data: { src: "x".repeat(4_000_001) } }], edges: [] });
    rerender({ snapshot: huge, canEdit: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(updateBoard).not.toHaveBeenCalled();
    expect(result.current.save).toBe("toolarge");
  });

  it("maps a 413 rejection to the toolarge save state", async () => {
    const err = new Error("HTTP 413");
    err.status = 413;
    updateBoard.mockRejectedValueOnce(err);
    const { result, rerender } = setup();
    rerender({ snapshot: snap1, canEdit: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(result.current.save).toBe("toolarge");
  });

  it("maps a 401 rejection to the unauth save state", async () => {
    const err = new Error("HTTP 401");
    err.status = 401;
    updateBoard.mockRejectedValueOnce(err);
    const { result, rerender } = setup();
    rerender({ snapshot: snap1, canEdit: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(result.current.save).toBe("unauth");
  });

  it("maps a 500 rejection to the failed save state", async () => {
    const err = new Error("HTTP 500");
    err.status = 500;
    updateBoard.mockRejectedValueOnce(err);
    const { result, rerender } = setup();
    rerender({ snapshot: snap1, canEdit: true, makeThumb: vi.fn() });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(result.current.save).toBe("failed");
  });

  it("maps a 403 rejection to the failed save state", async () => {
    const err = new Error("HTTP 403");
    err.status = 403;
    updateBoard.mockRejectedValueOnce(err);
    const { result, rerender } = setup();
    rerender({ snapshot: snap1, canEdit: true, makeThumb: vi.fn() });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(result.current.save).toBe("failed");
  });

  it("maps a 429 rejection to the failed save state", async () => {
    const err = new Error("HTTP 429");
    err.status = 429;
    updateBoard.mockRejectedValueOnce(err);
    const { result, rerender } = setup();
    rerender({ snapshot: snap1, canEdit: true, makeThumb: vi.fn() });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(result.current.save).toBe("failed");
  });

  it("also refreshes the gallery thumbnail on autosave (not just Cmd+S)", async () => {
    const { rerender, makeThumb } = setup();
    rerender({ snapshot: snap1, canEdit: true, makeThumb });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(updateBoard).toHaveBeenCalledWith("b1", JSON.parse(snap1));
    expect(makeThumb).toHaveBeenCalledTimes(1);
    expect(updateBoard).toHaveBeenCalledWith("b1", { thumbnail: "thumb-data" });
  });

  it("throttles the autosave thumbnail refresh to at most once per 30s", async () => {
    const { rerender, makeThumb } = setup();
    rerender({ snapshot: snap1, canEdit: true, makeThumb });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(makeThumb).toHaveBeenCalledTimes(1);

    const snap2 = boardSnapshot({ ...board, title: "Case 3" });
    rerender({ snapshot: snap2, canEdit: true, makeThumb });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    // Still inside the 30s window - no second capture.
    expect(makeThumb).toHaveBeenCalledTimes(1);
  });

  it("skips the autosave thumbnail refresh while the tab is hidden", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const { rerender, makeThumb } = setup();
    rerender({ snapshot: snap1, canEdit: true, makeThumb });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(updateBoard).toHaveBeenCalledWith("b1", JSON.parse(snap1));
    expect(makeThumb).not.toHaveBeenCalled();
  });

  it("frames the whole board on open, every time", async () => {
    const { fitView } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fitView).toHaveBeenCalledWith({ padding: 0.18, duration: 0 });
  });
});

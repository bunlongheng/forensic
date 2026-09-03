// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

vi.mock("../../src/lib/api.js", () => ({ updateBoard: vi.fn() }));
vi.mock("../../src/lib/localBoard.js", () => ({ saveDraft: vi.fn(), loadDraft: vi.fn(), clearDraft: vi.fn(), loadViewport: vi.fn() }));

import { updateBoard } from "../../src/lib/api.js";
import { saveDraft, loadDraft, clearDraft, loadViewport } from "../../src/lib/localBoard.js";
import { useBoardPersistence } from "../../src/hooks/useBoardPersistence.js";
import { boardSnapshot } from "../../src/lib/boardGraph.js";

const board = { id: "b1", title: "Case", nodes: [{ id: "n", type: "note", position: { x: 0, y: 0 }, data: {} }], edges: [] };
const snap0 = boardSnapshot(board);
const snap1 = boardSnapshot({ ...board, title: "Case 2" });

function setup(props = {}) {
  const restore = vi.fn(), fitView = vi.fn(), setViewport = vi.fn(), showToast = vi.fn();
  const hook = renderHook(
    ({ snapshot, canEdit }) => useBoardPersistence({ board, canEdit, snapshot, restore, fitView, setViewport, showToast }),
    { initialProps: { snapshot: snap0, canEdit: true, ...props } },
  );
  return { restore, fitView, setViewport, showToast, ...hook };
}

beforeEach(() => {
  vi.useFakeTimers();
  updateBoard.mockResolvedValue({});
  loadDraft.mockResolvedValue(null);
  loadViewport.mockReturnValue(null);
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
    const { restore, fitView, showToast, result } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(restore).toHaveBeenCalledWith(JSON.parse(snap1));
    expect(showToast).toHaveBeenCalledWith("Restored your unsaved changes");
    expect(fitView).toHaveBeenCalled();
    expect(result.current.restoreReady.current).toBe(true);
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
    const huge = "x".repeat(4_300_001);
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

  it("restores the saved viewport on open instead of fitting", async () => {
    const vp = { x: 10, y: 20, zoom: 1.5 };
    loadViewport.mockReturnValue(vp);
    const { setViewport, fitView } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(setViewport).toHaveBeenCalledWith(vp, { duration: 0 });
    expect(fitView).not.toHaveBeenCalled();
  });
});

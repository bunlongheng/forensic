// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useUndoRedo } from "../../src/hooks/useUndoRedo.js";

afterEach(cleanup);

const snap = (n) => JSON.stringify({ title: `v${n}`, nodes: [], edges: [] });

function setup(canEdit = true) {
  const restore = vi.fn();
  const hook = renderHook(({ snapshot }) => useUndoRedo({ snapshot, canEdit, restore }), { initialProps: { snapshot: snap(0) } });
  return { restore, ...hook };
}

describe("useUndoRedo", () => {
  it("starts with nothing to undo, then enables undo after a change", () => {
    const { result, rerender } = setup();
    expect(result.current.canUndo).toBe(false);
    rerender({ snapshot: snap(1) });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("undo restores the previous snapshot and redo re-applies it", () => {
    const { result, rerender, restore } = setup();
    rerender({ snapshot: snap(1) });
    act(() => result.current.undo());
    expect(restore).toHaveBeenLastCalledWith(JSON.parse(snap(0)));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(restore).toHaveBeenLastCalledWith(JSON.parse(snap(1)));
    expect(result.current.canRedo).toBe(false);
  });

  it("does not record the snapshot written by a restore", () => {
    const { result, rerender, restore } = setup();
    rerender({ snapshot: snap(1) });
    act(() => result.current.undo());
    rerender({ snapshot: snap(0) }); // the board re-renders with the restored content
    expect(result.current.canRedo).toBe(true); // redo tail kept - the restore was not re-recorded
    act(() => result.current.redo());
    expect(restore).toHaveBeenCalledTimes(2);
  });

  it("a new change after undo drops the redo tail", () => {
    const { result, rerender } = setup();
    rerender({ snapshot: snap(1) });
    act(() => result.current.undo());
    rerender({ snapshot: snap(0) });
    rerender({ snapshot: snap(2) });
    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });

  it("Cmd+Z / Cmd+Shift+Z drive undo and redo, but not while typing", () => {
    const { result, rerender, restore } = setup();
    rerender({ snapshot: snap(1) });
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true })); });
    expect(restore).toHaveBeenLastCalledWith(JSON.parse(snap(0)));
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, shiftKey: true })); });
    expect(restore).toHaveBeenLastCalledWith(JSON.parse(snap(1)));
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true })); });
    expect(restore).toHaveBeenCalledTimes(2);
    expect(result.current.canUndo).toBe(true);
    input.remove();
  });

  it("records nothing when the board is read-only", () => {
    const { result, rerender } = setup(false);
    rerender({ snapshot: snap(1) });
    expect(result.current.canUndo).toBe(false);
  });
});

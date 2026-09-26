// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useLineUp } from "../../src/hooks/useLineUp.js";

afterEach(cleanup);

// Two photos side by side at DIFFERENT heights - the case the CMD line-up ghost
// exists for: drag the short one near the tall one and it offers the tall height.
const img = (id, x, y, w, h, extra = {}) => ({
  id, type: "image", position: { x, y }, style: { width: w, height: h }, data: {}, ...extra,
});
const SHORT = img("a", 0, 0, 100, 50);
const TALL = img("b", 200, 0, 100, 120);

function setup(nodes = [SHORT, TALL], edges = []) {
  const setNodes = vi.fn(), onNodesChange = vi.fn();
  const { result, rerender } = renderHook((p) => useLineUp({
    canEdit: true, nodes: p.nodes, edges, setNodes, onNodesChange,
    flowToScreenPosition: ({ x, y }) => ({ x: x + 5, y: y + 7 }),
    getViewport: () => ({ x: 0, y: 0, zoom: 2 }),
  }), { initialProps: { nodes } });
  return { result, rerender, setNodes, onNodesChange };
}

describe("useLineUp", () => {
  it("CMD-dragging a photo near another offers that photo's height as a ghost", () => {
    const { result } = setup();
    act(() => { result.current.onNodeDrag({ metaKey: true }, SHORT); });
    expect(result.current.ghost).toMatchObject({ id: "a", h: 120, same: false });
    // Screen-space box: mapped position, size scaled by the live zoom.
    expect(result.current.hintBox).toEqual({ left: 5, top: 7, width: 480, height: 240 });
  });

  it("no modifier, no ghost", () => {
    const { result } = setup();
    act(() => { result.current.onNodeDrag({}, SHORT); });
    expect(result.current.ghost).toBeNull();
    expect(result.current.hintBox).toBeNull();
  });

  it("releasing with the ghost up commits the suggested size to width AND style", () => {
    const { result, setNodes } = setup();
    act(() => { result.current.onNodeDrag({ metaKey: true }, SHORT); });
    act(() => { result.current.onDragStop(); });
    const out = setNodes.mock.calls[0][0]([SHORT, TALL]);
    expect(out[0]).toMatchObject({ height: 120, style: { width: out[0].width, height: 120 } });
    expect(out[1]).toBe(TALL);
    expect(result.current.ghost).toBeNull();
  });

  it("SHIFT-dragging lines a photo up with the node it is wired to", () => {
    const { result, setNodes } = setup([SHORT, TALL], [{ id: "e1", source: "a", target: "b" }]);
    // Nudge the short photo so its centre is nearly level with the tall one's.
    const dragged = img("a", 0, 40, 100, 50);
    act(() => { result.current.onNodeDrag({ shiftKey: true }, dragged); });
    const out = setNodes.mock.calls[0][0]([dragged, TALL]);
    expect(out[0].position.y).toBe(35); // centred on the tall photo's centre (60)
    expect(result.current.ghost).toBeNull();
  });

  it("freezes the snapshot for the length of a drag and thaws on release", () => {
    const { result } = setup();
    expect(result.current.busy).toBe(false);
    act(() => { result.current.onDragStart(); });
    expect(result.current.busy).toBe(true);
    act(() => { result.current.onDragStop(); });
    expect(result.current.busy).toBe(false);
  });

  it("a pointerup that React Flow never reports still ends the drag", () => {
    const { result } = setup();
    act(() => { result.current.onDragStart(); });
    act(() => { window.dispatchEvent(new Event("pointerup")); });
    expect(result.current.busy).toBe(false);
  });

  it("a resize in flight freezes the snapshot too", () => {
    const { result } = setup([{ ...SHORT, resizing: true }, TALL]);
    expect(result.current.busy).toBe(true);
  });

  it("CMD held rewrites the drag's position change and draws guides", () => {
    const { result, onNodesChange } = setup();
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Meta", metaKey: true })); });
    // 2px off the tall photo's left edge - inside snapAlign's range.
    const change = { id: "a", type: "position", position: { x: 198, y: 0 }, dragging: true };
    act(() => { result.current.onNodesChangeSnap([change]); });
    const [applied] = onNodesChange.mock.calls[0];
    expect(applied[0].position.x).toBe(200);
    expect(result.current.guides.length).toBeGreaterThan(0);
    // Letting CMD go takes the guides down with it.
    act(() => { window.dispatchEvent(new KeyboardEvent("keyup", { key: "Meta" })); });
    expect(result.current.guides).toEqual([]);
  });

  it("without CMD the changes pass straight through untouched", () => {
    const { result, onNodesChange } = setup();
    const change = { id: "a", type: "position", position: { x: 198, y: 0 }, dragging: true };
    act(() => { result.current.onNodesChangeSnap([change]); });
    expect(onNodesChange).toHaveBeenCalledWith([change]);
  });
});

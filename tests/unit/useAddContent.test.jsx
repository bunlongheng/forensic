// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAddContent } from "../../src/hooks/useAddContent.js";
import { DOUBLE_TAP_MS, DROP_DEBOUNCE_MS } from "../../src/lib/constants.js";

afterEach(cleanup);

// jsdom has no hit testing; nothing in these tests is parked under the chrome.
document.elementFromPoint = () => null;

// The board wrapper's box. screenToFlowPosition is the identity here, so a screen
// coordinate in a test IS the board coordinate it lands on.
const RECT = { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 };

function setup({ canEdit = true, readOnly = null } = {}) {
  const setNodes = vi.fn(), showToast = vi.fn();
  const click = vi.fn();
  const wrapRef = { current: { getBoundingClientRect: () => RECT } };
  const fabRef = { current: { getBoundingClientRect: () => ({ left: 40, top: 700, width: 46, height: 46 }) } };
  const fileRef = { current: { click } };
  const screenToFlowPosition = (p) => ({ x: p.x, y: p.y });
  const { result } = renderHook(() => useAddContent({
    canEdit, readOnly, setNodes, showToast, screenToFlowPosition, wrapRef, fabRef, fileRef,
  }));
  // Run a setNodes updater against `nds` and hand back the new node list.
  const applied = (nds = [], call = 0) => setNodes.mock.calls[call][0](nds);
  return { result, setNodes, showToast, click, applied };
}

const dropEvent = (over) => ({
  preventDefault: vi.fn(), clientX: 300, clientY: 200,
  dataTransfer: { files: [], getData: (k) => (k === "text/uri-list" ? "https://example.com/x" : ""), ...over },
});

describe("useAddContent", () => {
  it("pins a dragged link as an exhibit card where it was dropped", () => {
    const { result, showToast, applied } = setup();
    act(() => { result.current.onDrop(dropEvent()); });
    const [node] = applied([]);
    expect(node.type).toBe("file");
    expect(node.position).toEqual({ x: 300, y: 200 });
    expect(node.data.url).toBe("https://example.com/x");
    expect(node.data.editable).toBe(true);
    expect(showToast).toHaveBeenCalledWith("Pinned a link");
  });

  it("a second exhibit on the same spot steps down instead of burying the first", () => {
    const { result, applied } = setup();
    act(() => { result.current.addLink({ kind: "link", url: "u" }, { x: 10, y: 10 }); });
    const sitting = [{ id: "f1", type: "file", position: { x: 10, y: 10 } }];
    const [, added] = applied(sitting);
    expect(added.position).toEqual({ x: 34, y: 118 });
  });

  it("refuses a drop on a read-only board and says why", () => {
    const { result, setNodes, showToast } = setup({ canEdit: false, readOnly: "auth" });
    act(() => { result.current.onDrop(dropEvent()); });
    expect(setNodes).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Sign in to edit this board");
  });

  it("centerPos lands in the middle of the wrapper", () => {
    const { result } = setup();
    expect(result.current.centerPos()).toEqual({ x: 500, y: 400 });
  });

  it("pastePos falls back to the centre until the pointer has moved, then follows it", () => {
    const { result } = setup();
    expect(result.current.pastePos()).toEqual({ x: 500, y: 400 });
    act(() => { window.dispatchEvent(new MouseEvent("pointermove", { clientX: 120, clientY: 90 })); });
    expect(result.current.pastePos()).toEqual({ x: 120, y: 90 });
  });

  it("a double tap on the pane drops a clip, open for typing, exactly there", () => {
    const { result, setNodes, applied } = setup();
    act(() => {
      result.current.onPaneClick({ timeStamp: 1000, clientX: 210, clientY: 160 });
      result.current.onPaneClick({ timeStamp: 1000 + DOUBLE_TAP_MS - 1, clientX: 210, clientY: 160 });
    });
    expect(setNodes).toHaveBeenCalledTimes(1);
    const [node] = applied([]);
    expect(node.type).toBe("clip");
    expect(node.position).toEqual({ x: 210, y: 160 });
    expect(node.data.autoEdit).toBe(true);
  });

  it("two slow taps are not a double tap, and a second drop inside the debounce is swallowed", () => {
    const { result, setNodes } = setup();
    act(() => {
      result.current.onPaneClick({ timeStamp: 0, clientX: 1, clientY: 1 });
      result.current.onPaneClick({ timeStamp: DOUBLE_TAP_MS + 10, clientX: 1, clientY: 1 });
    });
    expect(setNodes).not.toHaveBeenCalled();
    // A real dblclick lands one note, and the repeat right behind it lands none.
    const pane = { classList: { contains: () => true } };
    act(() => {
      result.current.onPaneDoubleClick({ target: pane, timeStamp: 5000, clientX: 1, clientY: 1 });
      result.current.onPaneDoubleClick({ target: pane, timeStamp: 5000 + DROP_DEBOUNCE_MS - 1, clientX: 1, clientY: 1 });
    });
    expect(setNodes).toHaveBeenCalledTimes(1);
  });

  it("a double-click on a NODE is that node's business, not the pane's", () => {
    const { result, setNodes } = setup();
    act(() => {
      result.current.onPaneDoubleClick({ target: { classList: { contains: () => false } }, timeStamp: 1, clientX: 1, clientY: 1 });
    });
    expect(setNodes).not.toHaveBeenCalled();
  });

  it("the ring opens over the fab (clamped on-screen) and drops the picked tool on its own spot", () => {
    const { result, applied } = setup();
    act(() => { result.current.openRingAtFab(); });
    // The fab sits at (63, 723); RING_SAFE keeps the whole ring in a 1024x768
    // jsdom window, so the summon point is pulled up to y = 768 - 148.
    expect(result.current.ring).toMatchObject({ x: 148, y: 620, n: 1 });
    act(() => { result.current.pickRingTool({ key: "stamp", extra: { label: "SECRET" } }); });
    const [node] = applied([]);
    expect(node.type).toBe("stamp");
    expect(node.position).toEqual({ x: 148, y: 620 });
    expect(node.data.label).toBe("SECRET");
  });

  it("the Photo choice opens the file picker instead of adding a node", () => {
    const { result, setNodes, click } = setup();
    act(() => { result.current.openRingAtCenter(); });
    act(() => { result.current.pickRingTool({ action: "image" }); });
    expect(click).toHaveBeenCalledTimes(1);
    expect(setNodes).not.toHaveBeenCalled();
    act(() => { result.current.closeRing(); });
    expect(result.current.ring).toBeNull();
  });
});

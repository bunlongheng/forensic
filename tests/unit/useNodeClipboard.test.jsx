// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useNodeClipboard } from "../../src/hooks/useNodeClipboard.js";
import { NODE_COPY_MARKER } from "../../src/lib/boardGraph.js";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const node = { id: "a", type: "note", position: { x: 10, y: 10 }, data: { text: "hi" } };

function setup(sel = { kind: "note", id: "a" }, canEdit = true) {
  const setNodes = vi.fn(), addFiles = vi.fn(), addLink = vi.fn(), showToast = vi.fn();
  const centerPos = () => ({ x: 0, y: 0 });
  renderHook(() => useNodeClipboard({ canEdit, sel, nodes: [node], setNodes, addFiles, addLink, centerPos, showToast }));
  return { setNodes, addFiles, addLink, showToast };
}

const paste = (items = [], text = "") => {
  const e = new Event("paste", { cancelable: true });
  e.clipboardData = { items, getData: () => text };
  window.dispatchEvent(e);
  return e;
};

describe("useNodeClipboard", () => {
  it("Cmd+C then paste duplicates the selected node, offset, with a toast", () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { setNodes, showToast } = setup();
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", metaKey: true })); });
    expect(writeText).toHaveBeenCalledWith(NODE_COPY_MARKER);
    act(() => { paste([], NODE_COPY_MARKER); });
    expect(setNodes).toHaveBeenCalledTimes(1);
    const out = setNodes.mock.calls[0][0]([node]);
    expect(out).toHaveLength(2);
    expect(out[1].position).toEqual({ x: 40, y: 40 });
    expect(out[1].id).not.toBe("a");
    expect(showToast).toHaveBeenCalledWith("Pasted a copy");
  });

  it("a file on the clipboard always wins over a copied node", () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue() } });
    const { setNodes, addFiles } = setup();
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", metaKey: true })); });
    const file = new File(["x"], "shot.png", { type: "image/png" });
    act(() => { paste([{ kind: "file", type: "image/png", getAsFile: () => file }], NODE_COPY_MARKER); });
    expect(addFiles).toHaveBeenCalledWith([file], { x: 0, y: 0 });
    expect(setNodes).not.toHaveBeenCalled();
  });

  it("pins a pasted PDF as an exhibit, not just an image", () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
    const { addFiles } = setup(null);
    const file = new File(["%PDF"], "warrant.pdf", { type: "application/pdf" });
    act(() => { paste([{ kind: "file", type: "application/pdf", getAsFile: () => file }], ""); });
    expect(addFiles).toHaveBeenCalledWith([file], { x: 0, y: 0 });
  });

  it("pins a pasted URL as a link card and swallows the paste", () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
    const { addLink, setNodes } = setup(null);
    let e;
    act(() => { e = paste([], "https://example.com/docs/report.pdf"); });
    expect(addLink).toHaveBeenCalledWith(
      { kind: "pdf", url: "https://example.com/docs/report.pdf", name: "example.com/report.pdf" },
      { x: 0, y: 0 },
    );
    expect(e.defaultPrevented).toBe(true);
    expect(setNodes).not.toHaveBeenCalled();
  });

  it("does not copy an edge, and pasting foreign text does nothing", () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { setNodes } = setup({ kind: "edge", id: "e1" });
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", metaKey: true })); });
    expect(writeText).not.toHaveBeenCalled();
    act(() => { paste([], "some other text"); });
    expect(setNodes).not.toHaveBeenCalled();
  });

  it("is inert for a read-only viewer", () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    setup({ kind: "note", id: "a" }, false);
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", metaKey: true })); });
    expect(writeText).not.toHaveBeenCalled();
  });
});

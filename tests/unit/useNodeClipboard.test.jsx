// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useNodeClipboard, svgTextToFile } from "../../src/hooks/useNodeClipboard.js";
import { clearClip, readClip } from "../../src/lib/nodeClipboard.js";
import { NODE_COPY_MARKER } from "../../src/lib/boardGraph.js";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); clearClip(); });

const node = { id: "a", type: "note", position: { x: 10, y: 10 }, data: { text: "hi" } };

function setup(sel = { kind: "note", id: "a" }, canEdit = true, readOnly = null, nodes = null, edges = []) {
  const setNodes = vi.fn(), setEdges = vi.fn(), addFiles = vi.fn(), addLink = vi.fn(), showToast = vi.fn();
  // Stands in for the live pointer position - the board pastes where you are looking.
  const pastePos = () => ({ x: 640, y: 480 });
  const list = nodes || [{ ...node, selected: sel?.id === "a" }];
  renderHook(() => useNodeClipboard({
    canEdit, readOnly, nodes: list, setNodes, edges, setEdges,
    addFiles, addLink, pastePos, showToast,
  }));
  return { setNodes, setEdges, addFiles, addLink, showToast, list };
}

const press = (key) => window.dispatchEvent(new KeyboardEvent("keydown", { key, metaKey: true }));

const paste = (items = [], text = "") => {
  const e = new Event("paste", { cancelable: true });
  e.clipboardData = { items, getData: () => text };
  window.dispatchEvent(e);
  return e;
};

describe("useNodeClipboard", () => {
  it("Cmd+C then paste drops a copy AT THE CURSOR, with a toast", () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { setNodes, showToast } = setup();
    act(() => { press("c"); });
    expect(writeText).toHaveBeenCalledWith(NODE_COPY_MARKER);
    expect(showToast).toHaveBeenCalledWith("Copied 1 item");
    act(() => { paste([], NODE_COPY_MARKER); });
    const out = setNodes.mock.calls[0][0]([node]);
    expect(out).toHaveLength(2);
    // The source position is meaningless on another board, so it lands on the pointer.
    expect(out[1].position).toEqual({ x: 640, y: 480 });
    expect(out[1].id).not.toBe("a");
    expect(showToast).toHaveBeenCalledWith("Pasted 1 item");
  });

  it("Cmd+X removes the selection and its edges, and keeps it on the clipboard", () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
    const a = { ...node, id: "a", selected: true };
    const b = { id: "b", type: "note", position: { x: 300, y: 0 }, data: {} };
    const eds = [{ id: "e1", source: "a", target: "b" }];
    const { setNodes, setEdges, showToast } = setup(null, true, null, [a, b], eds);
    act(() => { press("x"); });
    expect(showToast).toHaveBeenCalledWith("Cut 1 item");
    expect(setNodes.mock.calls[0][0]([a, b]).map((n) => n.id)).toEqual(["b"]);
    // a thread to a node that is gone would render as a string to nowhere
    expect(setEdges.mock.calls[0][0](eds)).toEqual([]);
    expect(readClip().nodes.map((n) => n.id)).toEqual(["a"]);
  });

  // The whole point of cut: the clipboard has to outlive the board component,
  // because App renders <Board key={board.id}> and switching boards remounts it.
  it("survives the board unmounting, so a cut node pastes onto a different board", () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
    const first = setup();
    act(() => { press("x"); });
    cleanup(); // the board unmounts, exactly as it does when you open another one

    const second = setup(null, true, null, []);
    act(() => { paste([], NODE_COPY_MARKER); });
    const out = second.setNodes.mock.calls[0][0]([]);
    expect(out).toHaveLength(1);
    expect(out[0].data).toEqual(first.list[0].data);
    expect(out[0].id).not.toBe("a");
  });

  it("cuts a group with its children and the wiring between them", () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
    const g = { id: "g", type: "container", position: { x: 100, y: 100 }, data: {}, selected: true };
    const kid = { id: "k", type: "note", parentId: "g", position: { x: 10, y: 10 }, data: {} };
    const far = { id: "far", type: "note", position: { x: 900, y: 900 }, data: {} };
    const eds = [{ id: "in", source: "g", target: "k" }, { id: "out", source: "g", target: "far" }];
    const { setNodes, showToast } = setup(null, true, null, [g, kid, far], eds);
    act(() => { press("x"); });
    expect(showToast).toHaveBeenCalledWith("Cut 2 items");
    expect(setNodes.mock.calls[0][0]([g, kid, far]).map((n) => n.id)).toEqual(["far"]);

    const clip = readClip();
    expect(clip.nodes.map((n) => n.id)).toEqual(["g", "k"]);
    expect(clip.edges.map((e) => e.id)).toEqual(["in"]); // the edge to `far` cannot come
  });

  it("pastes a group keeping its layout, its parent link and its internal wiring", () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
    const g = { id: "g", type: "container", position: { x: 100, y: 100 }, data: {}, selected: true };
    const kid = { id: "k", type: "note", parentId: "g", position: { x: 10, y: 10 }, data: {} };
    const sibling = { id: "s", type: "note", position: { x: 300, y: 140 }, data: {}, selected: true };
    const eds = [{ id: "in", source: "s", target: "g" }];
    const { setNodes, setEdges } = setup(null, true, null, [g, kid, sibling], eds);
    act(() => { press("c"); });
    act(() => { paste([], NODE_COPY_MARKER); });

    const out = setNodes.mock.calls[0][0]([]);
    const container = out.find((n) => n.type === "container");
    const child = out.find((n) => n.parentId);
    const sib = out.find((n) => n.type === "note" && !n.parentId);
    expect(out).toHaveLength(3);
    expect(container.position).toEqual({ x: 640, y: 480 });   // top-left lands on the cursor
    expect(child.position).toEqual({ x: 10, y: 10 });          // relative to its parent, unmoved
    expect(child.parentId).toBe(container.id);                 // remapped to the NEW container
    expect(sib.position).toEqual({ x: 840, y: 520 });          // relative layout preserved
    const wires = setEdges.mock.calls.at(-1)[0]([]);
    expect(wires).toHaveLength(1);
    expect(wires[0].source).toBe(sib.id);
    expect(wires[0].target).toBe(container.id);
  });

  it("a file on the clipboard always wins over a copied node", () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue() } });
    const { setNodes, addFiles } = setup();
    act(() => { press("c"); });
    const file = new File(["x"], "shot.png", { type: "image/png" });
    act(() => { paste([{ kind: "file", type: "image/png", getAsFile: () => file }], NODE_COPY_MARKER); });
    expect(addFiles).toHaveBeenCalledWith([file], { x: 640, y: 480 });
    expect(setNodes).not.toHaveBeenCalled();
  });

  it("pins a pasted PDF as an exhibit, not just an image", () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
    const { addFiles } = setup(null);
    const file = new File(["%PDF"], "warrant.pdf", { type: "application/pdf" });
    act(() => { paste([{ kind: "file", type: "application/pdf", getAsFile: () => file }], ""); });
    expect(addFiles).toHaveBeenCalledWith([file], { x: 640, y: 480 });
  });

  it("pins a pasted URL as a link card and swallows the paste", () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
    const { addLink, setNodes } = setup(null);
    let e;
    act(() => { e = paste([], "https://example.com/docs/report.pdf"); });
    expect(addLink).toHaveBeenCalledWith(
      { kind: "pdf", url: "https://example.com/docs/report.pdf", name: "example.com/report.pdf" },
      { x: 640, y: 480 },
    );
    expect(e.defaultPrevented).toBe(true);
    expect(setNodes).not.toHaveBeenCalled();
  });

  it("does not copy an edge, and pasting foreign text does nothing", () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { setNodes } = setup(null, true, null, [{ ...node, selected: false }]);
    act(() => { press("c"); });
    expect(writeText).not.toHaveBeenCalled();
    act(() => { paste([], "some other text"); });
    expect(setNodes).not.toHaveBeenCalled();
  });

  it("is inert for a read-only viewer", () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { setNodes, addFiles } = setup({ kind: "note", id: "a" }, false);
    act(() => { press("c"); });
    expect(writeText).not.toHaveBeenCalled();
    act(() => { paste([], "https://example.com/x"); });
    expect(setNodes).not.toHaveBeenCalled();
    expect(addFiles).not.toHaveBeenCalled();
  });

  // The silent version of this is what reads as "paste is broken on prod".
  it("a signed-out viewer is TOLD the paste was refused, not ignored", () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
    const { showToast, addFiles } = setup(null, false, "auth");
    const file = new File(["%PDF"], "warrant.pdf", { type: "application/pdf" });
    act(() => { paste([{ kind: "file", type: "application/pdf", getAsFile: () => file }], ""); });
    expect(addFiles).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Sign in to edit this board");
    act(() => { paste([], "https://example.com/x"); });
    expect(showToast).toHaveBeenCalledTimes(2);
  });

  it("a read-only DEVICE says so, and plain text never nags", () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
    const { showToast } = setup(null, false, "device");
    act(() => { paste([], "just some words"); });
    expect(showToast).not.toHaveBeenCalled();
    act(() => { paste([], "https://example.com/x"); });
    expect(showToast).toHaveBeenCalledWith("Read-only on this device");
  });

  // Figma "Copy as SVG" and every code editor put SVG on the clipboard as TEXT.
  it("pins pasted SVG markup as a photo, not a link and not nothing", () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
    const { addFiles, addLink } = setup(null);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>';
    let e;
    act(() => { e = paste([], svg); });
    expect(e.defaultPrevented).toBe(true);
    expect(addLink).not.toHaveBeenCalled();
    const [files, at] = addFiles.mock.calls[0];
    expect(files[0].type).toBe("image/svg+xml");
    expect(files[0].name).toBe("pasted.svg");
    expect(at).toEqual({ x: 640, y: 480 });
  });

  it("does not mistake prose that mentions svg for markup", () => {
    expect(svgTextToFile("see the <svg> tag in the docs")).toBeNull();
    expect(svgTextToFile("https://example.com/logo.svg")).toBeNull();
    expect(svgTextToFile('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>')).not.toBeNull();
  });
});

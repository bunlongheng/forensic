// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useNodeClipboard, svgTextToFile } from "../../src/hooks/useNodeClipboard.js";
import { NODE_COPY_MARKER } from "../../src/lib/boardGraph.js";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const node = { id: "a", type: "note", position: { x: 10, y: 10 }, data: { text: "hi" } };

function setup(sel = { kind: "note", id: "a" }, canEdit = true, readOnly = null) {
  const setNodes = vi.fn(), addFiles = vi.fn(), addLink = vi.fn(), showToast = vi.fn();
  // Stands in for the live pointer position - the board pastes where you are looking.
  const pastePos = () => ({ x: 640, y: 480 });
  renderHook(() => useNodeClipboard({ canEdit, readOnly, sel, nodes: [node], setNodes, addFiles, addLink, pastePos, showToast }));
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
    const { setNodes } = setup({ kind: "edge", id: "e1" });
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", metaKey: true })); });
    expect(writeText).not.toHaveBeenCalled();
    act(() => { paste([], "some other text"); });
    expect(setNodes).not.toHaveBeenCalled();
  });

  it("is inert for a read-only viewer", () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { setNodes, addFiles } = setup({ kind: "note", id: "a" }, false);
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", metaKey: true })); });
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

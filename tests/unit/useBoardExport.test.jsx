// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

const toPng = vi.fn();
vi.mock("html-to-image", () => ({ toPng: (...a) => toPng(...a) }));

import { useBoardExport } from "../../src/hooks/useBoardExport.js";

const VP = { x: 12, y: 34, zoom: 1.5 };

function setup({ el = document.createElement("div"), title = "Case: Alpha!" } = {}) {
  const showToast = vi.fn(), fitView = vi.fn(), setViewport = vi.fn();
  const getViewport = vi.fn(() => VP);
  const { result } = renderHook(() => useBoardExport({
    boardId: "b1", title, wrapRef: { current: el }, canvasColor: "#e0cfa6",
    showToast, fitView, getViewport, setViewport,
  }));
  return { result, showToast, fitView, setViewport };
}

// The export waits 2 frames for the fitted board to paint before capturing.
const twoFrames = async () => {
  await act(async () => { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
};

beforeEach(() => { toPng.mockReset().mockResolvedValue("data:image/png;base64,AA"); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("useBoardExport", () => {
  it("copies a share link to the board and says so", async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { result, showToast } = setup();
    await act(async () => { await result.current.share(); });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/?id=b1`);
    expect(showToast).toHaveBeenCalledWith("Share link copied");
  });

  it("says so when the clipboard refuses", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("nope")) } });
    const { result, showToast } = setup();
    await act(async () => { await result.current.share(); });
    expect(showToast).toHaveBeenCalledWith("Copy failed");
  });

  it("fits the WHOLE board, captures it, then puts the viewport back", async () => {
    const clicked = vi.fn();
    const { result, fitView, setViewport } = setup();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clicked);

    act(() => { result.current.exportPng(); });
    expect(fitView).toHaveBeenCalledWith({ padding: 0.1, duration: 0 });
    await twoFrames();
    await act(async () => {});

    expect(toPng).toHaveBeenCalledTimes(1);
    expect(toPng.mock.calls[0][1]).toMatchObject({ backgroundColor: "#e0cfa6", pixelRatio: 2 });
    expect(clicked).toHaveBeenCalledTimes(1);
    // The owner's zoom and pan come back exactly as they were.
    expect(setViewport).toHaveBeenCalledWith(VP, { duration: 0 });
  });

  it("leaves the chrome out of the capture", async () => {
    const { result } = setup();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    act(() => { result.current.exportPng(); });
    await twoFrames();
    await act(async () => {});

    const { filter } = toPng.mock.calls[0][1];
    const withClass = (c) => { const d = document.createElement("div"); d.className = c; return d; };
    expect(filter(withClass("react-flow__node"))).toBe(true);
    expect(filter(withClass("fx-noexport"))).toBe(false);
    expect(filter(withClass("react-flow__minimap"))).toBe(false);
    expect(filter(withClass("react-flow__controls"))).toBe(false);
  });

  it("reports a failed capture and still restores the viewport", async () => {
    toPng.mockRejectedValue(new Error("tainted"));
    const { result, showToast, setViewport } = setup();
    act(() => { result.current.exportPng(); });
    await twoFrames();
    await act(async () => {});
    expect(showToast).toHaveBeenCalledWith("Export failed");
    expect(setViewport).toHaveBeenCalledWith(VP, { duration: 0 });
  });

  it("does nothing at all when the board wrapper is not mounted", () => {
    const { result, fitView } = setup({ el: null });
    act(() => { result.current.exportPng(); });
    expect(fitView).not.toHaveBeenCalled();
  });
});

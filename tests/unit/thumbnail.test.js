// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const toCanvas = vi.fn();
vi.mock("html-to-image", () => ({ toCanvas: (...a) => toCanvas(...a) }));

const getNodesBounds = vi.fn();
const getViewportForBounds = vi.fn();
vi.mock("@xyflow/react", () => ({
  getNodesBounds: (...a) => getNodesBounds(...a),
  getViewportForBounds: (...a) => getViewportForBounds(...a),
}));

const { makeThumbnail } = await import("../../src/lib/thumbnail.js");

// Mirrors the module's own constants (src/lib/thumbnail.js).
const W = 520;
const H = 200;
const SCALE = 2;

const NODES = [{ id: "a", position: { x: 0, y: 0 } }];

beforeEach(() => {
  toCanvas.mockReset();
  getNodesBounds.mockReset();
  getViewportForBounds.mockReset();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("makeThumbnail", () => {
  it("returns null for an empty board without touching the DOM", async () => {
    const out = await makeThumbnail([]);
    expect(out).toBeNull();
    expect(getNodesBounds).not.toHaveBeenCalled();
    expect(toCanvas).not.toHaveBeenCalled();
  });

  it("returns null when .react-flow__viewport is not mounted", async () => {
    const out = await makeThumbnail(NODES);
    expect(out).toBeNull();
    expect(toCanvas).not.toHaveBeenCalled();
  });

  it("captures the viewport at W*SCALE x H*SCALE and resolves a data URL", async () => {
    const el = document.createElement("div");
    el.className = "react-flow__viewport";
    document.body.appendChild(el);
    getNodesBounds.mockReturnValue({ x: 0, y: 0, width: 400, height: 300 });
    getViewportForBounds.mockReturnValue({ x: 10, y: 20, zoom: 1.2 });
    toCanvas.mockResolvedValue({ toDataURL: (type) => `data:${type};base64,AAAA` });

    const out = await makeThumbnail(NODES);

    expect(toCanvas).toHaveBeenCalledTimes(1);
    const [capturedEl, opts] = toCanvas.mock.calls[0];
    expect(capturedEl).toBe(el);
    expect(opts.width).toBe(W * SCALE);
    expect(opts.height).toBe(H * SCALE);
    expect(out).toMatch(/^data:image\//);
  });
});

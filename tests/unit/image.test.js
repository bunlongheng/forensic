// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { fileToImage, imageMime, isImageFile, svgIntrinsicSize } from "../../src/lib/image.js";

// The shrinker needs a real worker + ImageDecoder; here it is a switch, so the
// hand-off (and the progress stream) can be asserted without either.
const shrink = vi.hoisted(() => ({ can: false }));
vi.mock("../../src/lib/gifShrink.js", () => ({
  HARD_MAX_BYTES: 40_000_000,
  canShrinkGifs: () => shrink.can,
  shrinkGif: async (_file, onProgress) => {
    onProgress({ type: "progress", pass: 1, passes: 5, done: 3, total: 9, pct: 33 });
    return { src: "data:image/gif;base64,SHRUNK", width: 320, height: 400 };
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  shrink.can = false;
});

// jsdom has no real FileReader / image decode / canvas pipeline, so stand all
// three up: a reader that hands back `dataUrl`, an <img> that reports w x h, and
// a canvas whose toDataURL honors only the types listed in `encodes`.
function stubPipeline({ dataUrl, w = 10, h = 10, encodes = ["image/webp"], out = "X", alpha = false }) {
  class FakeFileReader {
    readAsDataURL() { this.result = dataUrl; this.onload?.(); }
  }
  class FakeImage {
    set src(_v) { this.width = w; this.height = h; this.onload?.(); }
  }
  vi.stubGlobal("FileReader", FakeFileReader);
  vi.stubGlobal("Image", FakeImage);

  const calls = [];
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({
      drawImage: () => {},
      // 4 pixels; the alpha byte is what hasTransparency() samples.
      getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, alpha ? 0 : 255]) }),
    }),
    toDataURL: (type, q) => {
      calls.push({ type, q });
      // An engine that does not support `type` silently returns a PNG instead.
      return encodes.includes(type) ? `data:${type};base64,${out}` : "data:image/png;base64,PNGPNGPNG";
    },
  };
  vi.spyOn(document, "createElement").mockImplementation((tag) =>
    (tag === "canvas" ? canvas : document.createElement.wrappedMethod?.call(document, tag) ?? {}),
  );
  return calls;
}

const pngFile = (name = "shot.png") => {
  const f = new File(["x"], name, { type: "image/png" });
  Object.defineProperty(f, "size", { value: 100 });
  return f;
};

describe("fileToImage", () => {
  it("rejects a non-image File", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    await expect(fileToImage(file)).rejects.toThrow("Not an image");
  });

  it("re-encodes a PNG to WebP - the whole point, since a pasted screenshot is a PNG", async () => {
    const calls = stubPipeline({ dataUrl: "data:image/png;base64," + "A".repeat(500) });
    const result = await fileToImage(pngFile());
    expect(calls[0].type).toBe("image/webp");
    expect(result.src.startsWith("data:image/webp")).toBe(true);
  });

  it("re-encodes even a small image, so EXIF/ICC is always stripped on the way in", async () => {
    const calls = stubPipeline({ dataUrl: "data:image/jpeg;base64,AA", w: 8, h: 8 });
    await fileToImage(new File(["x"], "p.jpg", { type: "image/jpeg" }));
    expect(calls.length).toBeGreaterThan(0); // it went through the canvas, not straight through
  });

  it("falls back to JPEG (not PNG) when WebP is unsupported and the bitmap is opaque", async () => {
    const calls = stubPipeline({ dataUrl: "data:image/png;base64,AA", encodes: ["image/jpeg"], alpha: false });
    const result = await fileToImage(pngFile());
    expect(calls.map((c) => c.type)).toEqual(["image/webp", "image/jpeg"]);
    expect(result.src.startsWith("data:image/jpeg")).toBe(true);
  });

  it("falls back to PNG when WebP is unsupported and the bitmap really uses alpha", async () => {
    const calls = stubPipeline({ dataUrl: "data:image/png;base64,AA", encodes: ["image/png"], alpha: true });
    await fileToImage(pngFile("logo.png"));
    expect(calls.map((c) => c.type)).toEqual(["image/webp", "image/png"]);
  });

  it("keeps the original when a small lossy source would only grow", async () => {
    const dataUrl = "data:image/jpeg;base64,AA";
    stubPipeline({ dataUrl, out: "B".repeat(400) });
    const result = await fileToImage(new File(["x"], "tiny.jpg", { type: "image/jpeg" }));
    expect(result.src).toBe(dataUrl);
  });

  it("passes an SVG straight through - there is no raster size to shrink", async () => {
    const dataUrl = "data:image/svg+xml;base64,AA";
    stubPipeline({ dataUrl, w: 64, h: 64 });
    const result = await fileToImage(new File(["x"], "i.svg", { type: "image/svg+xml" }));
    expect(result).toEqual({ src: dataUrl, width: 64, height: 64 });
  });

  // Files arrive typeless or as application/octet-stream often enough that the
  // extension has to count - otherwise a .webp or .svg pins as an exhibit card.
  it("re-labels a typeless SVG so an <img> can actually render it", async () => {
    stubPipeline({ dataUrl: "data:application/octet-stream;base64,PHN2Zy8+", w: 40, h: 40 });
    const result = await fileToImage(new File(["<svg/>"], "logo.svg", { type: "" }));
    expect(result.src).toBe("data:image/svg+xml;base64,PHN2Zy8+");
  });

  it("treats a typeless .webp as a photo and re-encodes it like any other", async () => {
    const calls = stubPipeline({ dataUrl: "data:application/octet-stream;base64," + "A".repeat(500) });
    const f = new File(["x"], "shot.webp", { type: "application/octet-stream" });
    Object.defineProperty(f, "size", { value: 100 });
    const result = await fileToImage(f);
    expect(calls[0].type).toBe("image/webp");
    expect(result.src.startsWith("data:image/webp")).toBe(true);
  });
});

describe("fileToImage - GIF", () => {
  // A canvas keeps one frame. A GIF that stops moving is not the evidence pasted.
  it("passes a GIF straight through so it keeps animating", async () => {
    const dataUrl = "data:image/gif;base64,R0lGODlh";
    const calls = stubPipeline({ dataUrl, w: 120, h: 90 });
    const f = new File(["x"], "clip.gif", { type: "image/gif" });
    Object.defineProperty(f, "size", { value: 500_000 });
    const result = await fileToImage(f);
    expect(result).toEqual({ src: dataUrl, width: 120, height: 90 });
    expect(calls).toHaveLength(0); // never touched the canvas
  });

  // jsdom has no ImageDecoder, so an over-cap GIF cannot be shrunk here - the code
  // must say THAT, not "too large", so the toast can point at a browser that can.
  it("says a browser without ImageDecoder cannot shrink an over-cap GIF", async () => {
    stubPipeline({ dataUrl: "data:image/gif;base64,R0lGODlh" });
    const f = new File(["x"], "huge.gif", { type: "image/gif" });
    Object.defineProperty(f, "size", { value: 3_000_001 });
    await expect(fileToImage(f)).rejects.toMatchObject({ code: "no-shrink" });
  });

  it("refuses outright above the hard ceiling, without even trying", async () => {
    const f = new File(["x"], "monster.gif", { type: "image/gif" });
    Object.defineProperty(f, "size", { value: 40_000_001 });
    await expect(fileToImage(f)).rejects.toMatchObject({ code: "too-large" });
  });

  it("hands an over-cap GIF to the shrinker and streams its progress", async () => {
    shrink.can = true;
    const f = new File(["x"], "big.gif", { type: "image/gif" });
    Object.defineProperty(f, "size", { value: 4_800_000 });
    const seen = [];
    const result = await fileToImage(f, (p) => seen.push(p.pct));
    expect(result).toEqual({ src: "data:image/gif;base64,SHRUNK", width: 320, height: 400 });
    expect(seen).toEqual([33]);
  });
});

describe("isImageFile / imageMime", () => {
  const f = (name, type) => new File(["x"], name, { type });
  it("trusts an image MIME, falls back to the extension, refuses the rest", () => {
    expect(imageMime(f("a.bin", "image/webp"))).toBe("image/webp");
    expect(imageMime(f("logo.svg", ""))).toBe("image/svg+xml");
    expect(imageMime(f("shot.WEBP", "application/octet-stream"))).toBe("image/webp");
    expect(imageMime(f("pic.avif", ""))).toBe("image/avif");
    expect(isImageFile(f("warrant.pdf", "application/pdf"))).toBe(false);
    expect(isImageFile(f("notes.txt", ""))).toBe(false);
  });
});

// An <img> holding an SVG with no width/height reports the CSS default 300x150,
// which is not the drawing's shape - a 1:4 logo would become a 2:1 node with the
// art letterboxed inside it. The size has to come from the markup.
describe("svgIntrinsicSize", () => {
  it("prefers explicit width/height, with or without px", () => {
    expect(svgIntrinsicSize('<svg width="512px" height="128px" viewBox="0 0 400 200"></svg>'))
      .toEqual({ width: 512, height: 128 });
    expect(svgIntrinsicSize('<svg width="64" height="64"></svg>')).toEqual({ width: 64, height: 64 });
  });

  it("falls back to the viewBox, which is what carries the aspect ratio", () => {
    expect(svgIntrinsicSize('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 400"></svg>'))
      .toEqual({ width: 100, height: 400 });
    // a percentage width is not a size - the viewBox still has to win
    expect(svgIntrinsicSize('<svg width="100%" height="100%" viewBox="0 0 64 96"></svg>'))
      .toEqual({ width: 64, height: 96 });
    // negative min-x/min-y are legal and must not break the parse
    expect(svgIntrinsicSize('<svg viewBox="-20 -10 300 150"></svg>')).toEqual({ width: 300, height: 150 });
  });

  it("returns null when the markup says neither, so the caller can fall back", () => {
    expect(svgIntrinsicSize('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')).toBeNull();
    expect(svgIntrinsicSize("<div>hello</div>")).toBeNull();
    expect(svgIntrinsicSize("")).toBeNull();
    expect(svgIntrinsicSize(null)).toBeNull();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { fileToImage } from "../../src/lib/image.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fileToImage", () => {
  it("rejects a non-image File", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    await expect(fileToImage(file)).rejects.toThrow("Not an image");
  });

  it("returns { src, width, height } for a small image that needs no downscaling", async () => {
    const dataUrl = "data:image/png;base64,AAAA";

    // jsdom has no real FileReader/Image decode pipeline - stub both so the
    // "no downscale needed" branch (which never touches <canvas>) can be
    // exercised deterministically.
    class FakeFileReader {
      readAsDataURL() {
        this.result = dataUrl;
        this.onload?.();
      }
    }
    class FakeImage {
      set src(_v) {
        this.width = 10;
        this.height = 10;
        this.onload?.();
      }
    }
    vi.stubGlobal("FileReader", FakeFileReader);
    vi.stubGlobal("Image", FakeImage);

    const file = new File(["tiny"], "pin.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 100 });

    const result = await fileToImage(file);
    expect(result).toEqual({ src: dataUrl, width: 10, height: 10 });
  });
});

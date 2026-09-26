// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ATTACH_MAX, kindOf, prettySize, parseLink, fileToAttachment, dataUrlToBlob, openAttachment, isSafeUrl,
} from "../../src/lib/attach.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("kindOf", () => {
  it("reads the MIME type first", () => {
    expect(kindOf("application/pdf", "x")).toBe("pdf");
    expect(kindOf("audio/mpeg", "x")).toBe("audio");
    expect(kindOf("video/mp4", "x")).toBe("video");
    expect(kindOf("text/csv", "x")).toBe("doc");
  });

  it("falls back to the extension when the browser gives no type", () => {
    expect(kindOf("", "warrant.PDF")).toBe("pdf");
    expect(kindOf("", "call.m4a")).toBe("audio");
    expect(kindOf("application/octet-stream", "clip.mov")).toBe("video");
    expect(kindOf("", "ledger.xlsx")).toBe("doc");
    expect(kindOf("", "evidence.bin")).toBe("file");
  });
});

describe("prettySize", () => {
  it("scales the unit", () => {
    expect(prettySize(900)).toBe("900 B");
    expect(prettySize(2048)).toBe("2 KB");
    expect(prettySize(1_572_864)).toBe("1.5 MB");
  });
});

describe("parseLink", () => {
  it("accepts a full URL and labels it host/last-segment", () => {
    expect(parseLink("https://www.example.com/case/notes")).toEqual({
      kind: "link", url: "https://www.example.com/case/notes", name: "example.com/notes",
    });
  });

  it("accepts a bare domain and adds https", () => {
    expect(parseLink("example.com")).toEqual({ kind: "link", url: "https://example.com/", name: "example.com" });
  });

  it("keeps the document's own icon for a link that points at one", () => {
    expect(parseLink("https://a.co/f/report.pdf").kind).toBe("pdf");
    expect(parseLink("https://a.co/f/call.mp3").kind).toBe("audio");
  });

  it("ignores ordinary text, other protocols and giant strings", () => {
    expect(parseLink("just some notes")).toBeNull();
    expect(parseLink("javascript:alert(1)")).toBeNull();
    expect(parseLink("file:///etc/passwd")).toBeNull();
    expect(parseLink("")).toBeNull();
    expect(parseLink(`https://a.co/${"x".repeat(2100)}`)).toBeNull();
  });
});

describe("fileToAttachment", () => {
  it("returns node data with the bytes inline", async () => {
    const file = new File(["%PDF-1.4"], "warrant.pdf", { type: "application/pdf" });
    const out = await fileToAttachment(file);
    expect(out.kind).toBe("pdf");
    expect(out.name).toBe("warrant.pdf");
    expect(out.size).toBe(file.size);
    expect(out.src.startsWith("data:application/pdf")).toBe(true);
  });

  it("refuses a file too big to ever save, with a code the caller can explain", async () => {
    const big = new File(["x"], "raw.wav", { type: "audio/wav" });
    Object.defineProperty(big, "size", { value: ATTACH_MAX + 1 });
    await expect(fileToAttachment(big)).rejects.toMatchObject({ code: "too-large" });
  });
});

describe("dataUrlToBlob", () => {
  it("decodes base64 without fetch (the CSP blocks a data: fetch)", async () => {
    const blob = dataUrlToBlob(`data:application/pdf;base64,${btoa("%PDF-1.4")}`);
    expect(blob.type).toBe("application/pdf");
    expect(await blob.text()).toBe("%PDF-1.4");
  });

  it("decodes a plain (non-base64) data URL", async () => {
    const blob = dataUrlToBlob("data:text/plain,hello%20there");
    expect(await blob.text()).toBe("hello there");
  });
});

// A board can arrive from the agent API or a paste, so a link node's url is
// untrusted input - only these 3 schemes may ever reach window.open or an href.
describe("isSafeUrl", () => {
  it("allows http, https and mailto", () => {
    expect(isSafeUrl("https://example.com/a")).toBe(true);
    expect(isSafeUrl("http://example.com/a")).toBe(true);
    expect(isSafeUrl("mailto:owner@example.com")).toBe(true);
  });

  it("refuses every other scheme and anything unparseable", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUrl("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeUrl("blob:https://example.com/x")).toBe(false);
    expect(isSafeUrl("/api/boards/1")).toBe(false);
    expect(isSafeUrl("")).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
  });
});

describe("openAttachment", () => {
  it("opens a link straight to its URL in a new tab", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    expect(openAttachment({ kind: "link", url: "https://example.com/" })).toBe(true);
    expect(open).toHaveBeenCalledWith("https://example.com/", "_blank", "noopener,noreferrer");
  });

  it("hands an embedded file over as a blob - browsers refuse a data: tab", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });
    expect(openAttachment({ kind: "pdf", src: `data:application/pdf;base64,${btoa("%PDF")}` })).toBe(true);
    expect(open).toHaveBeenCalledWith("blob:x", "_blank", "noopener,noreferrer");
  });

  it("refuses to open a link node carrying a javascript: or data: url", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    expect(openAttachment({ kind: "link", url: "javascript:alert(document.cookie)" })).toBe(false);
    expect(openAttachment({ kind: "link", url: "data:text/html,<script>alert(1)</script>" })).toBe(false);
    expect(openAttachment({ kind: "link", url: "file:///etc/passwd" })).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  // A blob: document is same-origin, so an HTML src would run its script under
  // the app's own origin. Anything outside the viewable allowlist downloads.
  it("downloads a data:text/html src instead of opening it as a same-origin document", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    expect(openAttachment({ kind: "doc", name: "evil.html", src: "data:text/html,<script>alert(1)</script>" })).toBe(true);

    expect(open).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(document.querySelector("a[download]")).toBeNull(); // the anchor is removed again
  });

  // SVG is an image that can carry <script>, so it is the 1 image type outside the allowlist.
  it("downloads an image/svg+xml src instead of opening it", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    expect(openAttachment({ kind: "image", name: "evil.svg", src: "data:image/svg+xml,<svg onload=alert(1)/>" })).toBe(true);

    expect(open).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });

  it("does nothing when there is neither a url nor bytes", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    expect(openAttachment({ kind: "file" })).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});

import { describe, it, expect } from "vitest";
import { buildReport, detectLinks } from "../../src/lib/report.js";

const node = (id, type, data = {}) => ({ id, type, data });

describe("buildReport", () => {
  it("collects note text from note/clip/text/callout types", () => {
    const nodes = [
      node("a", "note", { text: "note text" }),
      node("b", "clip", { text: "clip text" }),
      node("c", "text", { text: "text text" }),
      node("d", "callout", { text: "callout text" }),
      node("e", "image", { label: "not a note" }),
    ];
    const r = buildReport("Case", nodes, []);
    expect(r.notes.map((n) => n.text)).toEqual(["note text", "clip text", "text text", "callout text"]);
    expect(r.counts.notes).toBe(4);
  });

  it("headlines an image by its label, or 'Photo' when uncaptioned", () => {
    const nodes = [node("a", "image", { label: "Suspect car" }), node("b", "image", {})];
    const r = buildReport("Case", nodes, []);
    expect(r.images).toEqual([{ id: "a", label: "Suspect car" }, { id: "b", label: "" }]);
  });

  it("headlines profile and stamp nodes", () => {
    const nodes = [
      node("p", "profile", { name: "Jane Doe" }),
      node("p2", "profile", {}),
      node("s", "stamp", { label: "URGENT" }),
      node("c", "crosshair", {}),
    ];
    const edges = [
      { source: "p", target: "s" },
      { source: "p2", target: "c" },
    ];
    const r = buildReport("Case", nodes, edges);
    expect(r.connections).toEqual([
      { from: "Jane Doe", to: "URGENT" },
      { from: "Person", to: "Crosshair" },
    ]);
  });

  it("connections map uses headlines for a container and a plain text node", () => {
    const nodes = [
      node("c", "container", { title: "Suspects" }),
      node("t", "text", { text: "first line\nsecond line" }),
      node("u", "annotation", {}),
    ];
    const edges = [
      { source: "c", target: "t" },
      { source: "t", target: "u" },
    ];
    const r = buildReport("Case", nodes, edges);
    expect(r.connections).toEqual([
      { from: "Suspects", to: "first line" },
      // 'Circle' is the registry's label for the annotation type - the report
      // reads it from there now instead of title-casing the raw type key.
      { from: "first line", to: "Circle" },
    ]);
  });

  it("headlines an untitled node with the registry's label, not the report's own word", () => {
    const nodes = [
      node("c", "container", {}),
      node("p", "profile", {}),
      node("i", "image", {}),
      node("s", "stamp", {}),
    ];
    const edges = [
      { source: "c", target: "p" },
      { source: "i", target: "s" },
    ];
    const r = buildReport("Case", nodes, edges);
    // 'Group', not the 'Section' the report used to hard-code beside the registry.
    expect(r.connections).toEqual([
      { from: "Group", to: "Person" },
      { from: "Photo", to: "Stamp" },
    ]);
  });

  it("returns an empty report for an empty board", () => {
    const r = buildReport("", [], []);
    expect(r.title).toBe("Untitled Board");
    expect(r.counts).toEqual({ notes: 0, images: 0, connections: 0, links: 0, files: 0, people: 0 });
    expect(r.notes).toEqual([]);
    expect(r.images).toEqual([]);
    expect(r.links).toEqual([]);
    expect(r.connections).toEqual([]);
    expect(r.files).toEqual([]);
    expect(r.people).toEqual([]);
  });

  it("lists file nodes as exhibits, using the link name or the attached file's name", () => {
    const nodes = [
      node("f1", "file", { url: "https://example.com/report", name: "example.com/report" }),
      node("f2", "file", { name: "evidence.pdf" }),
      node("f3", "file", {}),
    ];
    const r = buildReport("Case", nodes, []);
    expect(r.files).toEqual([
      { id: "f1", label: "example.com/report", url: "https://example.com/report" },
      { id: "f2", label: "evidence.pdf", url: null },
      { id: "f3", label: "Attachment", url: null },
    ]);
    expect(r.counts.files).toBe(3);
  });

  it("lists profile nodes as people, falling back to 'Person' with no name", () => {
    const nodes = [node("p1", "profile", { name: "Jane Doe" }), node("p2", "profile", {})];
    const r = buildReport("Case", nodes, []);
    expect(r.people).toEqual([{ id: "p1", name: "Jane Doe" }, { id: "p2", name: "Person" }]);
    expect(r.counts.people).toBe(2);
  });

  it("adds file/link node URLs to the links list, deduped against text-detected URLs", () => {
    const nodes = [
      node("n", "note", { text: "see https://example.com for more" }),
      node("f", "file", { url: "https://example.com", name: "example.com" }),
      node("g", "file", { url: "https://other.com/doc", name: "other.com/doc" }),
      node("h", "file", { name: "no-url.pdf" }),
    ];
    const r = buildReport("Case", nodes, []);
    expect(r.links).toEqual(["https://example.com", "https://other.com/doc"]);
    expect(r.counts.links).toBe(2);
  });
});

describe("detectLinks", () => {
  it("pulls unique, normalized URLs out of text", () => {
    expect(detectLinks("see https://example.com and https://example.com again, plus www.other.com.")).toEqual([
      "https://example.com",
      "https://www.other.com",
    ]);
  });
});

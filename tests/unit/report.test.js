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
      { from: "first line", to: "Annotation" },
    ]);
  });

  it("returns an empty report for an empty board", () => {
    const r = buildReport("", [], []);
    expect(r.title).toBe("Untitled Board");
    expect(r.counts).toEqual({ notes: 0, images: 0, connections: 0, links: 0 });
    expect(r.notes).toEqual([]);
    expect(r.images).toEqual([]);
    expect(r.links).toEqual([]);
    expect(r.connections).toEqual([]);
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

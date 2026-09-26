import { describe, it, expect } from "vitest";
import { NODE_REGISTRY, REGISTRY_TOOLS, nodeSpec } from "../../src/lib/nodeRegistry.js";
import { TOOL_ITEMS } from "../../src/lib/tools.js";
import { newNodeSpec, addNode } from "../../src/lib/boardGraph.js";
import { STAMP_LABELS } from "../../src/lib/constants.js";

// The registry is the single source of truth for a board object type. These
// tests are the guard rail on that claim: every derived list has to come back
// with exactly the registry's types, and nothing may declare a type the
// registry does not know about.
const TYPES = Object.keys(NODE_REGISTRY);

describe("node registry", () => {
  it("ships the 15 board object types", () => {
    expect(TYPES.sort()).toEqual([
      "annotation", "callout", "clip", "container", "crosshair", "drawing", "file",
      "image", "note", "profile", "redaction", "stamp", "sticker", "text", "wax",
    ]);
  });

  it("every entry declares a label and an inspector panel", () => {
    for (const [type, e] of Object.entries(NODE_REGISTRY)) {
      expect(typeof e.label, type).toBe("string");
      expect(e.label.length, type).toBeGreaterThan(0);
      expect(typeof e.inspector, type).toBe("string");
      expect(typeof e.resizes, type).toBe("boolean");
    }
  });

  // The registry is imported by the pure graph layer (boardGraph.js and its
  // hooks), so a renderer leaking back in here would drag React into every one
  // of those importers. The components live in nodeTypes.js.
  it("stays pure data - no entry carries a component", () => {
    for (const [type, e] of Object.entries(NODE_REGISTRY)) {
      expect(e.component, type).toBeUndefined();
    }
  });

  it("the tool ring is the registry's tools, in registry order", () => {
    expect(TOOL_ITEMS).toBe(REGISTRY_TOOLS);
    expect(TOOL_ITEMS.map((t) => t.key)).toEqual([
      "clip", "note", "text", "callout", "annotation", "person",
      "stamp", "wax", "redaction", "crosshair", "drawing", "container",
    ]);
  });

  it("every tool resolves to a real type - directly or through its choices", () => {
    for (const t of TOOL_ITEMS) {
      const keys = t.choices ? t.choices.filter((c) => c.key).map((c) => c.key) : [t.key];
      // 'person' is a chooser, not a type: its choices are what land on the board.
      if (!t.choices) expect(TYPES, t.key).toContain(t.key);
      for (const k of keys) expect(TYPES, k).toContain(k);
    }
  });

  it("the stamp tool's choices come from STAMP_LABELS in constants.js", () => {
    const stamp = TOOL_ITEMS.find((t) => t.key === "stamp");
    expect(stamp.choices.map((c) => c.extra.label)).toEqual(STAMP_LABELS);
  });

  it("boardGraph's newNodeSpec is the registry's spec", () => {
    for (const type of TYPES) {
      expect(newNodeSpec(type, []), type).toEqual(nodeSpec(type, []));
    }
    // Only the photo has no blank default - it arrives with its own bytes.
    const blank = TYPES.filter((t) => newNodeSpec(t, []) === null);
    expect(blank).toEqual(["image"]);
    expect(newNodeSpec("nope", [])).toBeNull();
  });

  it("every type with a spec can actually be added to a board", () => {
    for (const type of TYPES.filter((t) => NODE_REGISTRY[t].spec)) {
      const out = addNode([], type, { x: 0, y: 0 }, undefined, true);
      expect(out, type).toHaveLength(1);
      expect(out[0].type, type).toBe(type);
      expect(out[0].data.editable, type).toBe(true);
    }
  });

  it("a type the registry does not know adds nothing", () => {
    expect(addNode([], "marker", { x: 0, y: 0 })).toEqual([]);
  });
});

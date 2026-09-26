// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { NODE_TYPES } from "../../src/lib/nodeTypes.js";
import { NODE_REGISTRY } from "../../src/lib/nodeRegistry.js";

// nodeTypes.js is the seam between the pure registry and the 15 renderers. The
// contract: exactly one component per declared type, in registry order, so a
// type can never be declared without a renderer (React Flow would drop the
// node) or rendered without being declared.
describe("NODE_TYPES", () => {
  it("has exactly the registry's types, in registry order", () => {
    expect(Object.keys(NODE_TYPES)).toEqual(Object.keys(NODE_REGISTRY));
  });

  // Every renderer ships as memo(Node), so the value is a React element type
  // (an object), not a bare function - assert it is renderable, not callable.
  it("maps every type to a real component", () => {
    for (const [type, component] of Object.entries(NODE_TYPES)) {
      expect(component, type).toBeTruthy();
      expect(["function", "object"], type).toContain(typeof component);
    }
  });
});

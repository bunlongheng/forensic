import { describe, it, expect } from "vitest";
import { snapAlign, SNAP_THRESHOLD } from "../../src/lib/snapAlign.js";

const node = (id, x, y, w = 200, h = 100, extra = {}) => ({
  id, type: "image", position: { x, y }, style: { width: w, height: h }, ...extra,
});

describe("snapAlign", () => {
  it("latches a near-miss left edge onto the other node's left edge", () => {
    const target = node("t", 500, 0);
    const dragged = { ...node("d", 504, 400), position: { x: 504, y: 400 } };
    const { position, guides } = snapAlign(dragged, [target, dragged]);
    expect(position.x).toBe(500);
    expect(guides.find((g) => g.axis === "x").at).toBe(500);
  });

  it("aligns on centers, not just edges", () => {
    const target = node("t", 0, 0, 200, 100);       // center x = 100
    const dragged = { ...node("d", 44, 400, 100, 60) }; // center x = 94, delta 6
    expect(snapAlign(dragged, [target, dragged]).position.x).toBe(50);
  });

  it("leaves a node alone when nothing is within the threshold", () => {
    const target = node("t", 0, 0);
    const dragged = node("d", 900, 900);
    const { position, guides } = snapAlign(dragged, [target, dragged]);
    expect(position).toEqual({ x: 900, y: 900 });
    expect(guides).toEqual([]);
  });

  it("snaps both axes at once and returns a guide for each", () => {
    const target = node("t", 0, 0);
    const dragged = node("d", 6, 106); // x -> 0 (left edges), y -> 100 (top onto bottom)
    const { position, guides } = snapAlign(dragged, [target, dragged]);
    expect(position).toEqual({ x: 0, y: 100 });
    expect(guides.map((g) => g.axis).sort()).toEqual(["x", "y"]);
  });

  it("picks the CLOSEST candidate line when several are in range", () => {
    const near = node("near", 3, 0);
    const far = node("far", 8, 0);
    expect(snapAlign(node("d", 0, 400), [near, far]).position.x).toBe(3);
  });

  it("never aligns to a grouped child - its position is parent-relative", () => {
    const child = { ...node("c", 4, 0), parentId: "g" };
    expect(snapAlign(node("d", 0, 400), [child]).guides).toEqual([]);
  });

  it("spans the guide across both nodes so the line connects them", () => {
    const target = node("t", 500, 0, 200, 100);
    const dragged = node("d", 504, 400, 200, 100);
    const g = snapAlign(dragged, [target, dragged]).guides.find((x) => x.axis === "x");
    expect(g.from).toBe(0);    // target's top
    expect(g.to).toBe(500);    // dragged node's bottom
  });

  it("respects a custom threshold", () => {
    const target = node("t", 0, 0);
    const dragged = node("d", SNAP_THRESHOLD + 5, 400);
    expect(snapAlign(dragged, [target, dragged]).guides).toEqual([]);
    expect(snapAlign(dragged, [target, dragged], 40).position.x).toBe(0);
  });
});

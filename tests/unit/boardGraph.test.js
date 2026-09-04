import { describe, it, expect } from "vitest";
import {
  sanitizeNodes, sanitizeEdges, withEditable, boardSnapshot, uid, nodeW, nodeH,
  newNodeSpec, addNode, duplicateNode, arrangeZ, groupNodes, ungroupNodes,
  threadPairs, addThreads, snapToConnected, styleNodes, styleEdges,
} from "../../src/lib/boardGraph.js";

const node = (id, x, y, extra = {}) => ({ id, type: "image", position: { x, y }, style: { width: 100, height: 50 }, data: {}, ...extra });

describe("sanitizeNodes", () => {
  it("strips the UI-only editable flag and transient React Flow state", () => {
    const [n] = sanitizeNodes([{ id: "a", type: "note", position: { x: 1, y: 2 }, selected: true, dragging: true, data: { text: "hi", editable: true } }]);
    expect(n).toEqual({ id: "a", type: "note", position: { x: 1, y: 2 }, style: {}, data: { text: "hi" } });
  });

  it("folds a NodeResizer size (n.width/n.height) back into style so a resize survives reload", () => {
    const [n] = sanitizeNodes([{ id: "a", type: "image", position: { x: 0, y: 0 }, width: 300, height: 200, style: { width: 100, height: 50 } }]);
    expect(n.style).toEqual({ width: 300, height: 200 });
  });

  it("keeps auto-height nodes height-less so they stay content-sized", () => {
    const [n] = sanitizeNodes([{ id: "a", type: "clip", position: { x: 0, y: 0 }, measured: { width: 210, height: 88 }, style: { width: 210 } }]);
    expect(n.style).toEqual({ width: 210 });
  });
});

describe("sanitizeEdges / withEditable / boardSnapshot", () => {
  it("drops edge selection", () => {
    expect(sanitizeEdges([{ id: "e", source: "a", target: "b", selected: true }])).toEqual([{ id: "e", source: "a", target: "b" }]);
  });

  it("withEditable stamps every node's data", () => {
    expect(withEditable([{ id: "a", data: { t: 1 } }], false)[0].data).toEqual({ t: 1, editable: false });
  });

  it("boardSnapshot is stable across selection/drag noise and defaults the title", () => {
    const a = boardSnapshot({ title: "", nodes: [node("a", 0, 0, { selected: true })], edges: [] });
    const b = boardSnapshot({ title: "", nodes: [node("a", 0, 0)], edges: [] });
    expect(a).toBe(b);
    expect(JSON.parse(a).title).toBe("Untitled Board");
  });

  it("uid is unique and prefixed", () => {
    const a = uid("img"), b = uid("img");
    expect(a).toMatch(/^img-/);
    expect(a).not.toBe(b);
  });

  it("nodeW/nodeH prefer style, then measured, then defaults", () => {
    expect(nodeW({ style: { width: 10 } })).toBe(10);
    expect(nodeW({ measured: { width: 20 } })).toBe(20);
    expect(nodeW({})).toBe(150);
    expect(nodeH({})).toBe(90);
  });
});

describe("newNodeSpec / addNode", () => {
  it("numbers markers and cycles profile names from what is already on the board", () => {
    const nds = [{ type: "marker" }, { type: "marker" }, { type: "profile" }];
    expect(newNodeSpec("marker", nds).data.number).toBe(3);
    expect(newNodeSpec("profile", nds).data.name).not.toBe(newNodeSpec("profile", []).data.name);
    expect(newNodeSpec("nope", nds)).toBeNull();
  });

  it("cascades new objects and merges extra data", () => {
    const one = addNode([], "text", { x: 0, y: 0 }, { autoEdit: true });
    const two = addNode(one, "text", { x: 0, y: 0 });
    expect(one[0].position).toEqual({ x: 0, y: 0 });
    expect(one[0].data.autoEdit).toBe(true);
    expect(two[1].position).toEqual({ x: 28, y: 28 });
  });

  it("sends a container to the back of the stack, offset up-left", () => {
    const nds = addNode([node("a", 0, 0)], "container", { x: 200, y: 200 });
    expect(nds[0].type).toBe("container");
    expect(nds[0].position).toEqual({ x: 40, y: 80 });
    expect(nds[0].zIndex).toBe(0);
  });

  it("returns the same array for an unknown type", () => {
    const nds = [];
    expect(addNode(nds, "unknown", { x: 0, y: 0 })).toBe(nds);
  });
});

describe("duplicateNode / arrangeZ", () => {
  it("duplicates with a fresh id, offset and no selection", () => {
    const src = node("a", 10, 10, { selected: true, data: { src: "x" } });
    const c = duplicateNode(src);
    expect(c.id).not.toBe("a");
    expect(c.position).toEqual({ x: 40, y: 40 });
    expect(c.selected).toBe(false);
    expect(c.data).toEqual({ src: "x" });
    expect(c.data).not.toBe(src.data);
  });

  it("arrangeZ bumps past the current extremes", () => {
    const nds = [node("a", 0, 0, { zIndex: 3 }), node("b", 0, 0)];
    expect(arrangeZ(nds, "b", "front")[1].zIndex).toBe(4);
    expect(arrangeZ(nds, "b", "back")[1].zIndex).toBe(-1);
  });
});

describe("groupNodes / ungroupNodes", () => {
  const sel = () => [node("a", 100, 100, { selected: true }), node("b", 300, 200, { selected: true }), node("c", 0, 0)];

  it("wraps the selection in a container with relative child positions", () => {
    const out = groupNodes(sel());
    const g = out[0];
    expect(g.type).toBe("container");
    expect(g.position).toEqual({ x: 74, y: 74 });
    expect(g.style).toEqual({ width: 352, height: 202 });
    const a = out.find((n) => n.id === "a");
    expect(a.parentId).toBe(g.id);
    expect(a.position).toEqual({ x: 26, y: 26 });
    expect(a.selected).toBe(false);
    expect(out.find((n) => n.id === "c").parentId).toBeUndefined();
  });

  it("needs at least 2 selected top-level nodes", () => {
    const nds = [node("a", 0, 0, { selected: true })];
    expect(groupNodes(nds)).toBe(nds);
  });

  it("ungroup restores absolute positions (round-trip)", () => {
    const grouped = groupNodes(sel());
    const freed = ungroupNodes(grouped); // the new container is selected
    expect(freed.find((n) => n.type === "container")).toBeUndefined();
    expect(freed.find((n) => n.id === "a").position).toEqual({ x: 100, y: 100 });
    expect(freed.find((n) => n.id === "b").position).toEqual({ x: 300, y: 200 });
    expect(freed.find((n) => n.id === "a").parentId).toBeUndefined();
  });

  it("ungroup is a no-op without a selected container", () => {
    const nds = sel();
    expect(ungroupNodes(nds)).toBe(nds);
  });
});

describe("threadPairs / addThreads", () => {
  it("chain walks nearest-neighbour from the topmost node", () => {
    const sel = [node("far", 900, 300), node("top", 0, 0), node("mid", 120, 10)];
    expect(threadPairs(sel, "chain")).toEqual([["top", "mid"], ["mid", "far"]]);
  });

  it("fan wires the biggest node out to the rest", () => {
    const sel = [node("s1", 0, 0), node("hub", 0, 0, { style: { width: 400, height: 300 } }), node("s2", 0, 0)];
    expect(threadPairs(sel, "fan")).toEqual([["hub", "s1"], ["hub", "s2"]]);
  });

  it("returns nothing for fewer than 2 nodes", () => {
    expect(threadPairs([node("a", 0, 0)], "chain")).toEqual([]);
  });

  it("addThreads skips pairs already wired in either direction", () => {
    const eds = [{ id: "e1", source: "b", target: "a" }];
    const out = addThreads(eds, [["a", "b"], ["b", "c"]]);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ source: "b", target: "c" });
    expect(addThreads(eds, [["a", "b"]])).toBe(eds);
  });
});

describe("snapToConnected", () => {
  const edges = [{ id: "e", source: "a", target: "b" }];
  it("aligns centers with a connected node when within range", () => {
    const a = node("a", 0, 0);
    const b = node("b", 500, 12); // 12px off on Y - snaps; 500 on X - does not
    expect(snapToConnected(b, [a, b], edges)).toEqual({ x: 500, y: 0 });
  });

  it("returns null when nothing is connected or nothing is within range", () => {
    expect(snapToConnected(node("a", 0, 0), [node("a", 0, 0)], [])).toBeNull();
    expect(snapToConnected(node("b", 500, 500), [node("a", 0, 0), node("b", 500, 500)], edges)).toBeNull();
  });
});

describe("styleNodes / styleEdges", () => {
  it("locks and sends back per node data, leaving plain nodes untouched", () => {
    const plain = node("p", 0, 0);
    const out = styleNodes([plain, node("l", 0, 0, { data: { locked: true } }), node("b", 0, 0, { data: { back: true } })]);
    expect(out[0]).toBe(plain);
    expect(out[1].draggable).toBe(false);
    expect(out[2].zIndex).toBe(-1);
  });

  it("lights only the threads touching the selected node, keeps the rest solid", () => {
    const edges = [{ id: "e1", source: "a", target: "b" }, { id: "e2", source: "c", target: "d", data: { color: "#123456" } }];
    const [lit, idle] = styleEdges(edges, { kind: "image", id: "a" }, "#ff0000");
    expect(lit.animated).toBe(true);
    expect(lit.style.strokeWidth).toBe(4.6);
    expect(lit.style.stroke).toBe("#ff0000");
    expect(idle.animated).toBeUndefined();
    expect(idle.style.opacity).toBe(1);
    expect(idle.style.stroke).toBe("#123456");
    expect(idle.type).toBe("floating");
  });

  it("lights a thread when the thread itself is selected", () => {
    const [e] = styleEdges([{ id: "e1", source: "a", target: "b" }], { kind: "edge", id: "e1" }, "#f00");
    expect(e.style.strokeWidth).toBe(4.6);
  });
});

describe("sanitizeNodes keeps grouping and stacking", () => {
  it("round-trips parentId, relative position and zIndex through boardSnapshot", () => {
    const grouped = groupNodes([node("a", 100, 100, { selected: true, zIndex: 3 }), node("b", 300, 200, { selected: true })]);
    const back = JSON.parse(boardSnapshot({ title: "t", nodes: grouped, edges: [] })).nodes;
    const g = back.find((n) => n.type === "container");
    const a = back.find((n) => n.id === "a");
    expect(a.parentId).toBe(g.id);
    expect(a.position).toEqual({ x: 26, y: 26 });
    expect(a.zIndex).toBe(3);
    expect(g.zIndex).toBe(0);
    expect(back.find((n) => n.id === "b").parentId).toBe(g.id);
  });
});

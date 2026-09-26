import { describe, it, expect } from "vitest";
import { validateBoardFields } from "../../lib/validate.js";
import { sanitizeNodes } from "../../src/lib/boardGraph.js";

const validNode = (id) => ({ id, type: "note", position: { x: 0, y: 0 }, data: {} });

const BASE = {
  title: "Case File",
  nodes: [validNode("a")],
  edges: [],
  tags: ["fraud"],
  type: "board",
};

describe("validateBoardFields", () => {
  it("happy path: returns {} for a fully valid board", () => {
    expect(validateBoardFields(BASE)).toEqual({});
  });

  it("400s when title exceeds 200 characters", () => {
    const { error } = validateBoardFields({ ...BASE, title: "x".repeat(201) });
    expect(error).toBe("title too long (max 200 characters).");
  });

  it("rejects nodes over the 1000 cap", () => {
    const nodes = Array.from({ length: 1001 }, (_, i) => validNode(String(i)));
    const { error } = validateBoardFields({ ...BASE, nodes });
    expect(error).toBe("too many nodes (max 1000).");
  });

  it("rejects edges over the 2000 cap", () => {
    const edges = Array.from({ length: 2001 }, () => ({ source: "a", target: "b" }));
    const { error } = validateBoardFields({ ...BASE, edges });
    expect(error).toBe("too many edges (max 2000).");
  });

  it("rejects more than 50 tags", () => {
    const tags = Array.from({ length: 51 }, (_, i) => `t${i}`);
    const { error } = validateBoardFields({ ...BASE, tags });
    expect(error).toBe("too many tags (max 50).");
  });

  it("rejects a tag longer than 64 characters", () => {
    const { error } = validateBoardFields({ ...BASE, tags: ["x".repeat(65)] });
    expect(error).toBe("Every tag must be a string (max 64 characters).");
  });

  it("rejects a type longer than 40 characters", () => {
    const { error } = validateBoardFields({ ...BASE, type: "x".repeat(41) });
    expect(error).toBe("type must be a string (max 40 characters).");
  });

  it("partial mode skips fields the caller did not send", () => {
    expect(validateBoardFields({ tags: ["ok"] }, { partial: true })).toEqual({});
  });
});

describe("sanitizeNodes (src/lib/boardGraph.js)", () => {
  it("preserves parentId and zIndex", () => {
    const [n] = sanitizeNodes([
      { id: "a", type: "note", position: { x: 0, y: 0 }, data: {}, parentId: "g1", zIndex: 4 },
    ]);
    expect(n.parentId).toBe("g1");
    expect(n.zIndex).toBe(4);
  });
});

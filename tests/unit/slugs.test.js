import { describe, it, expect, vi } from "vitest";
import { toSlug } from "../../lib/slugs.js";

describe("toSlug", () => {
  it("slugifies a title", () => {
    expect(toSlug("Netflix System Design")).toBe("netflix-system-design");
    expect(toSlug("Uber @ Scale!!")).toBe("uber-scale");
  });
  it("falls back to 'untitled' for empty input", () => {
    expect(toSlug("")).toBe("untitled");
    expect(toSlug("   ")).toBe("untitled");
    expect(toSlug(null)).toBe("untitled");
  });
});

// Mock the DB so uniqueBoardSlug's collision logic can be tested without a
// real Postgres.
const query = vi.fn();
vi.mock("../../lib/db.js", () => ({ default: { query: (...a) => query(...a) } }));

const { uniqueBoardSlug } = await import("../../lib/slugs.js");

describe("uniqueBoardSlug", () => {
  it("returns the base slug when there is no collision", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const slug = await uniqueBoardSlug("owner-1", "Untitled Board");
    expect(slug).toBe("untitled-board");
    expect(query).toHaveBeenCalledWith(expect.any(String), ["owner-1", "untitled-board", "untitled-board-%"]);
  });

  it("appends -2 when the base slug is already taken", async () => {
    query.mockResolvedValueOnce({ rows: [{ slug: "untitled-board" }] });
    const slug = await uniqueBoardSlug("owner-1", "Untitled Board");
    expect(slug).toBe("untitled-board-2");
  });

  it("finds the first free counter when several are taken", async () => {
    query.mockResolvedValueOnce({
      rows: [{ slug: "untitled-board" }, { slug: "untitled-board-2" }, { slug: "untitled-board-3" }],
    });
    const slug = await uniqueBoardSlug("owner-1", "Untitled Board");
    expect(slug).toBe("untitled-board-4");
  });
});

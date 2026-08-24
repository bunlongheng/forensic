// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { listBoards, getBoard, createBoard, updateBoard, deleteBoard } from "../../src/lib/api.js";

function mockFetch(status, json) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(json),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api.js", () => {
  it("listBoards GETs /api/boards", async () => {
    mockFetch(200, [{ id: "1" }]);
    const rows = await listBoards();
    expect(global.fetch).toHaveBeenCalledWith("/api/boards");
    expect(rows).toEqual([{ id: "1" }]);
  });

  it("getBoard GETs /api/boards/:id", async () => {
    mockFetch(200, { id: "abc" });
    const row = await getBoard("abc");
    expect(global.fetch).toHaveBeenCalledWith("/api/boards/abc");
    expect(row).toEqual({ id: "abc" });
  });

  it("createBoard POSTs /api/boards with JSON body", async () => {
    mockFetch(201, { id: "new" });
    const row = await createBoard({ title: "X" });
    expect(global.fetch).toHaveBeenCalledWith("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "X" }),
    });
    expect(row).toEqual({ id: "new" });
  });

  it("updateBoard PUTs /api/boards/:id with JSON body", async () => {
    mockFetch(200, { id: "abc", title: "Y" });
    const row = await updateBoard("abc", { title: "Y" });
    expect(global.fetch).toHaveBeenCalledWith("/api/boards/abc", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Y" }),
    });
    expect(row).toEqual({ id: "abc", title: "Y" });
  });

  it("deleteBoard DELETEs /api/boards/:id", async () => {
    mockFetch(200, { deleted: true });
    const row = await deleteBoard("abc");
    expect(global.fetch).toHaveBeenCalledWith("/api/boards/abc", { method: "DELETE" });
    expect(row).toEqual({ deleted: true });
  });

  it("throws on a non-ok response", async () => {
    mockFetch(500, { error: "boom" });
    await expect(listBoards()).rejects.toThrow("HTTP 500");
  });
});

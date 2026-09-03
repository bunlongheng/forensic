import "dotenv/config";
import { test, expect } from "@playwright/test";

// End-to-end against a PRODUCTION build (npm run build && npm run start), the
// same handlers Vercel runs. Requests from Playwright's request context hit
// localhost, which lib/is-local.js treats as the owner (LOCAL_DEV=true in
// .env), so the full owner CRUD path is exercised without needing a session
// cookie or the Bearer secret.
const SECRET = process.env.FORENSIC_API_SECRET;

const VALID_BODY = {
  title: "E2E Forensic Board",
  nodes: [
    { id: "n1", type: "note", position: { x: 40, y: 200 }, data: { text: "evidence" } },
    { id: "n2", type: "note", position: { x: 260, y: 200 }, data: { text: "lead" } },
  ],
  edges: [{ source: "n1", target: "n2" }],
};

test("GET /api/health -> 200 ok:true", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.checks.database).toBe(true);
});

test("POST /api/ai/boards with a valid Bearer + body -> 201, then GET returns the same title", async ({
  request,
}) => {
  expect(SECRET).toBeTruthy();
  const create = await request.post("/api/ai/boards", {
    headers: { Authorization: `Bearer ${SECRET}` },
    data: VALID_BODY,
  });
  expect(create.status()).toBe(201);
  const row = await create.json();
  expect(row.id).toBeTruthy();
  expect(row.title).toBe(VALID_BODY.title);

  const got = await request.get(`/api/boards/${row.id}`);
  expect(got.status()).toBe(200);
  const board = await got.json();
  expect(board.title).toBe(VALID_BODY.title);

  // Clean up: the request originates from localhost, which lib/is-local.js
  // treats as the owner, so a plain DELETE (no auth header) is allowed here.
  const del = await request.delete(`/api/boards/${row.id}`);
  expect(del.status()).toBe(200);
});

test("localhost owner CRUD happy path: create -> get -> put -> delete", async ({ request }) => {
  const create = await request.post("/api/boards", { data: VALID_BODY });
  expect(create.status()).toBe(201);
  const row = await create.json();
  expect(row.id).toBeTruthy();

  const got = await request.get(`/api/boards/${row.id}`);
  expect(got.status()).toBe(200);
  expect((await got.json()).title).toBe(VALID_BODY.title);

  const put = await request.put(`/api/boards/${row.id}`, { data: { title: "Updated Board" } });
  expect(put.status()).toBe(200);
  expect((await put.json()).title).toBe("Updated Board");

  const del = await request.delete(`/api/boards/${row.id}`);
  expect(del.status()).toBe(200);
  expect((await del.json()).deleted).toBe(true);

  const goneGet = await request.get(`/api/boards/${row.id}`);
  expect(goneGet.status()).toBe(404);
});

test("POST /api/boards with an oversized title -> 400", async ({ request }) => {
  const res = await request.post("/api/boards", {
    data: { title: "x".repeat(5000), nodes: [], edges: [] },
  });
  expect(res.status()).toBe(400);
});

test("GET /api/boards -> 200 array (owner-only, localhost = owner)", async ({ request }) => {
  const res = await request.get("/api/boards");
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(Array.isArray(rows)).toBe(true);
});

test("Trash lifecycle: create (3+ nodes) -> DELETE trashes -> hidden -> restore -> visible -> purge", async ({
  request,
}) => {
  const create = await request.post("/api/boards", {
    data: {
      title: "E2E Trash Board",
      nodes: [
        { id: "n1", position: { x: 0, y: 0 } },
        { id: "n2", position: { x: 100, y: 0 } },
        { id: "n3", position: { x: 200, y: 0 } },
      ],
      edges: [],
    },
  });
  expect(create.status()).toBe(201);
  const { id } = await create.json();

  // 3+ nodes -> soft-deleted to Trash, not hard-deleted.
  const del = await request.delete(`/api/boards/${id}`);
  expect(del.status()).toBe(200);
  expect(await del.json()).toEqual({ trashed: true });

  // A trashed board is hidden from the public GET.
  const hidden = await request.get(`/api/boards/${id}`);
  expect(hidden.status()).toBe(404);

  // ...but listed under ?trash=1.
  const trashList = await request.get("/api/boards?trash=1");
  expect(trashList.status()).toBe(200);
  const trashRows = await trashList.json();
  expect(trashRows.some((r) => r.id === id)).toBe(true);

  // Restore brings it back.
  const restore = await request.put(`/api/boards/${id}`, { data: { restore: true } });
  expect(restore.status()).toBe(200);
  const visible = await request.get(`/api/boards/${id}`);
  expect(visible.status()).toBe(200);

  // Explicit purge hard-deletes it for good.
  const purge = await request.delete(`/api/boards/${id}?purge=1`);
  expect(purge.status()).toBe(200);
  expect(await purge.json()).toEqual({ deleted: true });
});

test("GET /api/boards strips inline image bytes from the preview projection", async ({ request }) => {
  const create = await request.post("/api/boards", {
    data: { title: "E2E preview", nodes: [{ id: "img", type: "image", position: { x: 0, y: 0 }, data: { src: "data:image/png;base64,AAAA", label: "photo" } }], edges: [] },
  });
  expect(create.status()).toBe(201);
  const { id } = await create.json();
  try {
    const rows = await (await request.get("/api/boards")).json();
    const row = rows.find((r) => r.id === id);
    expect(row).toBeTruthy();
    expect(row.nodes[0].data.src).toBeUndefined();
    expect(row.nodes[0].data.hasImage).toBe(true);
    expect(row.nodes[0].data.label).toBe("photo");
    // The full read still carries the bytes.
    const full = await (await request.get(`/api/boards/${id}`)).json();
    expect(full.nodes[0].data.src).toBe("data:image/png;base64,AAAA");
  } finally {
    await request.delete(`/api/boards/${id}?purge=1`);
  }
});

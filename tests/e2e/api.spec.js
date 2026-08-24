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

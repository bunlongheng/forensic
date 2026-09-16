import { test, expect } from "@playwright/test";

// Browser e2e against a production build with the strict CSP (no
// 'unsafe-eval'/'unsafe-inline' for scripts). Both landings must render with
// zero console errors: the localhost dev-mode gallery, and the signed-out
// sign-in screen a real hostname gets.

// Serve forensic.test from the real server, verbatim, so the app sees a real
// hostname (localhost is dev mode) with no session cookie => signed out.
const spoofHost = (page, baseURL) =>
  page.route("http://forensic.test/**", async (route) => {
    const u = new URL(route.request().url());
    const response = await route.fetch({ url: `${baseURL}${u.pathname}${u.search}` });
    // COOP is HTTPS-only by spec; on this plain-http spoof Chrome logs a console
    // error that would fail the zero-errors check. Prod is HTTPS, so drop it here.
    const headers = { ...response.headers() };
    delete headers["cross-origin-opener-policy"];
    await route.fulfill({ response, headers });
  });

const collectErrors = (page) => {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
};

test("localhost renders the dev-mode gallery under the strict CSP", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");

  await expect(page.getByText("FORENSIC")).toBeVisible();
  await expect(page.getByRole("button", { name: "New board" })).toBeVisible();
  await expect(page).toHaveTitle(/Forensic/);

  expect(errors).toEqual([]);
});

test("a real hostname, signed out, renders the sign-in screen", async ({ page, baseURL }) => {
  await spoofHost(page, baseURL);
  const errors = collectErrors(page);
  await page.goto("http://forensic.test/");

  await expect(page.getByText("FORENSIC")).toBeVisible();
  const link = page.getByRole("link", { name: "Continue with Google" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/api/auth/login");
  await expect(page).toHaveTitle(/Forensic/);

  expect(errors).toEqual([]);
});

// The bug this guards: a ?id= link skips the sign-in gate, so an expired session
// used to land on a board that LOOKED editable and swallowed every edit -
// paste included - with no pill, no banner and no toast.
test("a signed-out ?id= link says READ-ONLY and refuses a paste out loud", async ({ page, baseURL, request }) => {
  const create = await request.post("/api/boards", { data: { title: "E2E readonly", nodes: [], edges: [] } });
  const id = (await create.json()).id;
  await spoofHost(page, baseURL);
  const errors = collectErrors(page);

  try {
    await page.goto(`http://forensic.test/?id=${id}`);

    await expect(page.getByText("READ-ONLY")).toBeVisible();
    const signIn = page.getByRole("link", { name: "SIGN IN TO EDIT" });
    await expect(signIn).toHaveAttribute("href", "/api/auth/login");
    // The edit chrome is gone, so there is nothing to click that quietly fails.
    await expect(page.getByRole("button", { name: "Open add tools" })).toHaveCount(0);

    // A paste carrying real evidence gets an answer instead of silence.
    await page.evaluate(() => {
      const e = new Event("paste", { bubbles: true, cancelable: true });
      e.clipboardData = { items: [], getData: () => "https://example.com/warrant.pdf" };
      window.dispatchEvent(e);
    });
    await expect(page.getByText("Sign in to edit this board")).toBeVisible();

    expect(errors).toEqual([]);
  } finally {
    await fetch(`${baseURL}/api/boards/${id}?purge=1`, { method: "DELETE" }).catch(() => {});
  }
});

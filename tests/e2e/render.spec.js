import { test, expect } from "@playwright/test";

// Browser e2e against a production build with the strict CSP (no
// 'unsafe-eval'/'unsafe-inline' for scripts). Both landings must render with
// zero console errors: the localhost dev-mode gallery, and the signed-out
// sign-in screen a real hostname gets.

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
  // The app treats localhost as always-editable dev mode, so spoof a hostname:
  // every request to forensic.test is fetched from the real server and served
  // back verbatim (headers, CSP and all). No session cookie => signed out.
  await page.route("http://forensic.test/**", async (route) => {
    const u = new URL(route.request().url());
    const response = await route.fetch({ url: `${baseURL}${u.pathname}${u.search}` });
    await route.fulfill({ response });
  });
  const errors = collectErrors(page);
  await page.goto("http://forensic.test/");

  await expect(page.getByText("FORENSIC")).toBeVisible();
  const link = page.getByRole("link", { name: "Continue with Google" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/api/auth/login");
  await expect(page).toHaveTitle(/Forensic/);

  expect(errors).toEqual([]);
});

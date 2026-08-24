import { test, expect } from "@playwright/test";

// Browser e2e: the signed-out landing screen renders against a production
// build with the strict CSP (no 'unsafe-eval'/'unsafe-inline' for scripts).
test("the signed-out landing renders the sign-in screen", async ({ page }) => {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/");

  await expect(page.getByText("FORENSIC")).toBeVisible();
  const link = page.getByRole("link", { name: "Continue with Google" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/api/auth/login");

  await expect(page).toHaveTitle(/Forensic/);

  expect(errors).toEqual([]);
});

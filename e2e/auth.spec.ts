import { expect, test } from "@playwright/test";

test("signs up, signs out, and signs in", async ({ page }) => {
  const email = `developer-${Date.now()}@example.com`;
  const password = "flowforge-password";

  await page.goto("/workflows");
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/workflows$/);
  await expect(page.getByRole("heading", { name: "Workflows" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/workflows$/);
  await expect(page.getByRole("heading", { name: "Workflows" })).toBeVisible();
});

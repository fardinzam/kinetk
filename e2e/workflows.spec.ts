import { expect, test } from "@playwright/test";

test("creates and opens a workflow", async ({ page }) => {
  const email = `workflow-${crypto.randomUUID()}@example.com`;
  const password = "flowforge-password";
  const workflowName = `Webhook intake ${crypto.randomUUID()}`;

  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/workflows$/);

  await page.getByRole("button", { name: "New workflow" }).click();
  await page.getByLabel("Name").fill(workflowName);
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByRole("link", { name: workflowName })).toBeVisible();
  await page.getByRole("link", { name: workflowName }).click();

  await expect(page.getByRole("heading", { name: workflowName })).toBeVisible();
  await expect(page.getByLabel("Sync status")).toContainText("ready");
  await expect(page.getByLabel("Workflow editor")).toBeVisible();
  await expect(page.getByLabel("Workflow canvas")).toBeVisible();
});

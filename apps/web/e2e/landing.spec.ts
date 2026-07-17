import { expect, test } from "@playwright/test";

test("landing page exposes honest demo and upload paths", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /see what changed/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open labelled sample" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Compare revisions" })).toBeVisible();
});

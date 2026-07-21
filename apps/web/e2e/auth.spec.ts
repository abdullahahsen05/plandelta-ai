import { expect, test } from "@playwright/test";

test("legacy sign-in URL enters the guest access flow", async ({ page }) => {
  await page.goto("/auth/sign-in");

  await expect(page).toHaveURL(/\/app\/analyses\/sample\?guest=unavailable/);
  await expect(page.getByRole("heading", { name: "4 changes found" })).toBeVisible();
  await expect(page.getByLabel("Work email")).toHaveCount(0);
});

test("legacy auth callback falls through to guest access", async ({ page }) => {
  await page.goto("/auth/callback");

  await expect(page).toHaveURL(/\/app\/analyses\/sample\?guest=unavailable/);
  await expect(page.getByLabel("Work email")).toHaveCount(0);
});

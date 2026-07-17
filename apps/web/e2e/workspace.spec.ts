import { expect, test } from "@playwright/test";

test("fixture-driven project journey reaches the labelled evidence workbench", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.getByText("BUILT-IN SAMPLE", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: /Open Northline Office Renovation/ }).click();
  await expect(page.getByRole("heading", { name: "Compared revisions" })).toBeVisible();

  await page.getByRole("link", { name: "Open evidence review" }).click();
  await expect(page.getByText("PRECOMPUTED SAMPLE").first()).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Change ledger" })).toBeVisible();
  await expect(page.getByText("4 changes found")).toBeVisible();
});

test("comparison controls expose zoom, swipe, filtering, and evidence selection", async ({
  page,
}) => {
  await page.goto("/app/analyses/sample");

  await expect(page.getByRole("button", { name: "Side by side" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Swipe", exact: true }).click();
  await expect(page.getByLabel("Divider")).toBeVisible();

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByText("115%", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Removed", exact: true }).click();
  await expect(page.getByRole("button", { name: /Break-room sink removed/ })).toBeVisible();
  await page.getByRole("button", { name: /Break-room sink removed/ }).click();
  await expect(page.getByRole("heading", { name: "Break-room sink removed" })).toBeVisible();
});

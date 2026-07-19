import { expect, test } from "@playwright/test";

test("fixture-driven project journey reaches the labelled evidence workbench", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  const sampleLabels = page.getByText("BUILT-IN SAMPLE", { exact: true });
  await expect(sampleLabels).toHaveCount(2);
  await expect(sampleLabels.first()).toBeVisible();

  await Promise.all([
    page.waitForURL("**/app/projects/northline-office"),
    page.getByRole("link", { name: /Open Northline Office Renovation/ }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Compared revisions" })).toBeVisible();

  await Promise.all([
    page.waitForURL("**/app/analyses/sample"),
    page.getByRole("link", { name: "Open evidence review" }).click(),
  ]);
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
  await expect(page.getByRole("button", { name: /Fixture symbol removed/ })).toBeVisible();
  await page.getByRole("button", { name: /Fixture symbol removed/ }).click();
  await expect(page.getByRole("heading", { name: "Fixture symbol removed" })).toBeVisible();
});

test("projects and evidence remain usable at mobile width with reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);

  await page.goto("/app/analyses/sample");
  await expect(page.getByRole("heading", { name: "4 changes found" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

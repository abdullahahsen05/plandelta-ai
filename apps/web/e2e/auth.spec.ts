import { expect, test } from "@playwright/test";

test("passwordless sign-in boundary is available without exposing server credentials", async ({
  page,
}) => {
  await page.goto("/auth/sign-in");

  await expect(page.getByRole("heading", { name: "Access live projects" })).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeEditable();
  await expect(page.getByRole("button", { name: "Send secure sign-in link" })).toBeEnabled();
  await expect(page.getByText("SUPABASE AUTH · PASSWORDLESS EMAIL LINK")).toBeVisible();
});

test("invalid auth callback recovers with an actionable sign-in error", async ({ page }) => {
  await page.goto("/auth/callback");

  await expect(page).toHaveURL(/\/auth\/sign-in\?error=/);
  await expect(page.locator(".auth-error")).toContainText("sign-in link is invalid");
});

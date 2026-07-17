import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test("authenticated upload reaches real evidence and printable report", async ({
  context,
  page,
}) => {
  test.skip(process.env.PLANDELTA_LIVE_E2E !== "true", "Requires the bounded local service stack.");
  test.setTimeout(180_000);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey)
    throw new Error("Live E2E Supabase variables are missing.");

  const email = `plandelta-playwright-${randomUUID()}@example.invalid`;
  const password = `Browser-${randomUUID()}-7z!`;
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const browserAuth = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let userId: string | undefined;
  let projectId: string | undefined;
  let analysisId: string | undefined;

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error("User setup failed.");
    userId = created.data.user.id;
    const signedIn = await browserAuth.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session)
      throw signedIn.error ?? new Error("Sign-in failed.");

    const cookieValues: Array<{
      name: string;
      value: string;
      options: { path?: string; maxAge?: number; sameSite?: boolean | "lax" | "strict" | "none" };
    }> = [];
    const serverAuth = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => [],
        setAll: (values) => {
          cookieValues.push(...values);
        },
      },
    });
    const setSession = await serverAuth.auth.setSession(signedIn.data.session);
    if (setSession.error) throw setSession.error;
    await context.addCookies(
      cookieValues.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: "127.0.0.1",
        path: cookie.options.path ?? "/",
        expires: cookie.options.maxAge ? Math.floor(Date.now() / 1000) + cookie.options.maxAge : -1,
        sameSite:
          cookie.options.sameSite === "strict"
            ? "Strict"
            : cookie.options.sameSite === "none"
              ? "None"
              : "Lax",
      })),
    );

    await page.goto("/app/projects/new");
    await expect(page.getByText("AUTHENTICATED")).toBeVisible();
    await page.getByLabel("Project name").fill("Playwright live comparison");
    const fileInputs = page.locator('input[type="file"]');
    await fileInputs
      .nth(0)
      .setInputFiles(resolve(process.cwd(), "../../samples/vision/baseline.png"));
    await fileInputs
      .nth(1)
      .setInputFiles(resolve(process.cwd(), "../../samples/vision/added-wall.png"));
    await page.getByRole("button", { name: "Ready to analyze" }).click();

    await expect(page).toHaveURL(/\/app\/analyses\/[0-9a-f-]{36}/, { timeout: 30_000 });
    analysisId = page.url().split("/").at(-1);
    await expect(page.getByText("LIVE ANALYSIS").first()).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole("complementary", { name: "Change ledger" })).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.getByText(/1 evidence region/)).toBeVisible();
    await expect(page.locator(".live-evidence-crop img")).toHaveJSProperty("complete", true);

    const projectLink = page.locator(".workbench-crumbs a").first();
    const projectHref = await projectLink.getAttribute("href");
    projectId = projectHref?.split("/").at(-1);
    const reportPagePromise = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Print report" }).click();
    const reportPage = await reportPagePromise;
    await expect(
      reportPage.getByRole("heading", { name: "Revision evidence report" }),
    ).toBeVisible();
    await expect(reportPage.getByText(/evidence-based revision region/)).toBeVisible();
  } finally {
    if (projectId) await admin.from("projects").delete().eq("id", projectId);
    if (userId) await admin.auth.admin.deleteUser(userId);
    const repositoryRoot = resolve(process.cwd(), "../..");
    if (userId && projectId) {
      await rm(resolve(repositoryRoot, "data", "owners", userId, "projects", projectId), {
        recursive: true,
        force: true,
      });
    }
    if (analysisId) {
      await rm(resolve(repositoryRoot, "data", "analyses", analysisId), {
        recursive: true,
        force: true,
      });
    }
  }
});

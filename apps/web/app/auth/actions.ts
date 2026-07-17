"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getPublicAppOrigin } from "../../lib/app-origin";
import { isLiveProcessingEnabled } from "../../lib/live-processing";
import { createServerSupabaseClient } from "../../lib/supabase/server";

const emailSchema = z.string().trim().email().max(254);

export async function requestMagicLink(formData: FormData) {
  if (!isLiveProcessingEnabled()) {
    redirect("/auth/sign-in?error=Live+processing+is+temporarily+offline.");
  }

  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) {
    redirect("/auth/sign-in?error=Enter+a+valid+work+email.");
  }

  const supabase = await createServerSupabaseClient();
  const appUrl = getPublicAppOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      emailRedirectTo: `${appUrl.replace(/\/$/, "")}/auth/callback`,
    },
  });

  if (error) {
    redirect("/auth/sign-in?error=The+sign-in+email+could+not+be+sent.+Try+again.");
  }

  redirect("/auth/sign-in?status=check-email");
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/");
}

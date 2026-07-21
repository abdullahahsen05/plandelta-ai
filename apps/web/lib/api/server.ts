import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "../supabase/server";

export async function requireServerAccessToken() {
  const supabase = await createServerSupabaseClient();
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  if (!userData.user || !sessionData.session?.access_token) redirect("/auth/guest");
  return sessionData.session.access_token;
}

export async function optionalServerAccessToken() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

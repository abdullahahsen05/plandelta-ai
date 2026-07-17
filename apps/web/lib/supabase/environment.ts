export function publicSupabaseEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url)
    throw new Error("Missing required public environment variable: NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey)
    throw new Error("Missing required public environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return {
    url,
    publishableKey,
  };
}

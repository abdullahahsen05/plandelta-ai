function requirePublicVariable(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required public environment variable: ${name}`);
  return value;
}

export function publicSupabaseEnvironment() {
  return {
    url: requirePublicVariable("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: requirePublicVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

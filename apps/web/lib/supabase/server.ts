import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicSupabaseEnvironment } from "./environment";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const environment = publicSupabaseEnvironment();

  return createServerClient(environment.url, environment.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. The proxy refreshes sessions.
        }
      },
    },
  });
}

import { publicApiUrl } from "../../../../../lib/api/client";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ analysisId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  if (!userData.user || !sessionData.session?.access_token) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  const { analysisId } = await context.params;
  const upstream = await fetch(publicApiUrl(`/analyses/${analysisId}/report/print`), {
    headers: { authorization: `Bearer ${sessionData.session.access_token}` },
    cache: "no-store",
  });
  if (!upstream.ok)
    return Response.json({ error: "Report unavailable." }, { status: upstream.status });
  return new Response(upstream.body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:",
      "x-content-type-options": "nosniff",
    },
  });
}

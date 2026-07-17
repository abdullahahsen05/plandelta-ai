import { publicApiUrl } from "../../../../lib/api/client";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ artifactId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  if (!userData.user || !sessionData.session?.access_token) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  const { artifactId } = await context.params;
  const upstream = await fetch(publicApiUrl(`/artifacts/${artifactId}/download`), {
    headers: { authorization: `Bearer ${sessionData.session.access_token}` },
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: "Artifact unavailable." }, { status: upstream.status });
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

import { publicApiUrl } from "../../../../../../../lib/api/client";
import { createServerSupabaseClient } from "../../../../../../../lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string; projectId: string }> },
) {
  const supabase = await createServerSupabaseClient();
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  if (!userData.user || !sessionData.session?.access_token) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { documentId, projectId } = await context.params;
  const upstream = await fetch(
    publicApiUrl(`/projects/${projectId}/knowledge-documents/${documentId}/source`),
    {
      headers: { authorization: `Bearer ${sessionData.session.access_token}` },
      cache: "no-store",
    },
  );
  if (!upstream.ok) {
    return Response.json(
      { error: "Project evidence source unavailable." },
      { status: upstream.status },
    );
  }

  const bytes = new Uint8Array(await upstream.arrayBuffer());
  if (bytes.byteLength === 0) {
    return Response.json({ error: "Project evidence source was empty." }, { status: 502 });
  }
  return new Response(bytes, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": upstream.headers.get("content-disposition") ?? "inline",
      "content-length": String(bytes.byteLength),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

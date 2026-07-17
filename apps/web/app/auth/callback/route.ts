import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabaseClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next") ?? "/app";
  const next =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/app";

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/sign-in?error=The+sign-in+link+is+invalid.", request.url),
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL("/auth/sign-in?error=The+sign-in+link+has+expired.", request.url),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}

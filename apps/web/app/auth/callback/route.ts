import { NextResponse, type NextRequest } from "next/server";

import { getPublicAppOrigin } from "../../../lib/app-origin";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const appOrigin = getPublicAppOrigin();
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next") ?? "/app";
  const next =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/app";

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/sign-in?error=The+sign-in+link+is+invalid.", appOrigin),
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL("/auth/sign-in?error=The+sign-in+link+has+expired.", appOrigin),
    );
  }

  return NextResponse.redirect(new URL(next, appOrigin));
}

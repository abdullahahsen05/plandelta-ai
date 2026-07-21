import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { publicSupabaseEnvironment } from "../../../lib/supabase/environment";

function safeDestination(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("next");
  return requested?.startsWith("/app") && !requested.startsWith("//") ? requested : "/app";
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) {
    return NextResponse.redirect(new URL(safeDestination(request), request.url));
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.redirect(new URL("/app/analyses/sample?guest=unavailable", request.url));
  }

  const environment = publicSupabaseEnvironment();
  const admin = createClient(environment.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const identity = crypto.randomUUID();
  const email = `guest-${identity}@plandelta.demo`;
  // Supabase passwords are bcrypt-backed and must not exceed 72 characters.
  const password = `Pd1!${crypto.randomUUID()}`;
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { access: "public_guest" },
  });
  if (createError) {
    return NextResponse.redirect(new URL("/app/analyses/sample?guest=unavailable", request.url));
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return NextResponse.redirect(new URL("/app/analyses/sample?guest=unavailable", request.url));
  }

  return NextResponse.redirect(new URL(safeDestination(request), request.url));
}

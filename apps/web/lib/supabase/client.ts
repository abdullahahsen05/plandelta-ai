"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicSupabaseEnvironment } from "./environment";

export function createBrowserSupabaseClient() {
  const environment = publicSupabaseEnvironment();
  return createBrowserClient(environment.url, environment.publishableKey);
}

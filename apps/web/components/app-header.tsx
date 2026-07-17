import type { User } from "@supabase/supabase-js";
import { CircleUserRound, FolderKanban, LogOut, Plus } from "lucide-react";
import Link from "next/link";

import { signOut } from "../app/auth/actions";
import { isLiveProcessingEnabled } from "../lib/live-processing";
import { createServerSupabaseClient } from "../lib/supabase/server";
import { BrandMark } from "./brand-mark";

export async function AppHeader() {
  const liveProcessingEnabled = isLiveProcessingEnabled();
  let user: User | null = null;
  if (liveProcessingEnabled) {
    const supabase = await createServerSupabaseClient();
    user = (await supabase.auth.getUser()).data.user;
  }

  return (
    <header className="app-header">
      <BrandMark compact />
      <nav aria-label="Primary" className="flex h-full items-center">
        <Link className="app-nav-link" href="/app">
          <FolderKanban aria-hidden="true" size={16} strokeWidth={1.8} />
          <span className="hidden sm:inline">Projects</span>
        </Link>
        {liveProcessingEnabled ? (
          <Link className="app-nav-link" href="/app/projects/new">
            <Plus aria-hidden="true" size={16} strokeWidth={1.8} />
            <span className="hidden sm:inline">New comparison</span>
          </Link>
        ) : (
          <span
            aria-label="Live processing offline"
            className="app-nav-link cursor-not-allowed text-[#8A8984]"
            role="status"
          >
            <Plus aria-hidden="true" size={16} strokeWidth={1.8} />
            <span className="hidden sm:inline">Live offline</span>
          </span>
        )}
      </nav>
      <div className="ml-auto flex items-center gap-3 border-l border-[#D8D4CA] pl-3">
        <span className="technical hidden text-[10px] tracking-[0.08em] text-[#646762] md:inline">
          {liveProcessingEnabled ? (user ? "AUTHENTICATED" : "SAMPLE WORKSPACE") : "PORTFOLIO MODE"}
        </span>
        {user ? (
          <form action={signOut}>
            <button
              aria-label="Sign out"
              className="grid h-10 w-10 place-items-center"
              type="submit"
            >
              <LogOut aria-hidden="true" size={18} strokeWidth={1.6} />
            </button>
          </form>
        ) : liveProcessingEnabled ? (
          <Link
            aria-label="Sign in"
            className="grid h-10 w-10 place-items-center"
            href="/auth/sign-in"
          >
            <CircleUserRound aria-hidden="true" size={20} strokeWidth={1.6} />
          </Link>
        ) : (
          <span
            aria-label="Authentication offline"
            className="grid h-10 w-10 place-items-center text-[#8A8984]"
            role="status"
          >
            <CircleUserRound aria-hidden="true" size={20} strokeWidth={1.6} />
          </span>
        )}
      </div>
    </header>
  );
}

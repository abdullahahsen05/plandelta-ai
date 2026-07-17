import { CircleUserRound, FolderKanban, Plus } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "./brand-mark";

export function AppHeader() {
  return (
    <header className="app-header">
      <BrandMark compact />
      <nav aria-label="Primary" className="flex h-full items-center">
        <Link className="app-nav-link" href="/app">
          <FolderKanban aria-hidden="true" size={16} strokeWidth={1.8} />
          <span className="hidden sm:inline">Projects</span>
        </Link>
        <Link className="app-nav-link" href="/app/projects/new">
          <Plus aria-hidden="true" size={16} strokeWidth={1.8} />
          <span className="hidden sm:inline">New comparison</span>
        </Link>
      </nav>
      <div className="ml-auto flex items-center gap-3 border-l border-[#D8D4CA] pl-3">
        <span className="technical hidden text-[10px] tracking-[0.08em] text-[#646762] md:inline">
          LOCAL WORKSPACE
        </span>
        <Link
          aria-label="Sign in"
          className="grid h-10 w-10 place-items-center"
          href="/auth/sign-in"
        >
          <CircleUserRound aria-hidden="true" size={20} strokeWidth={1.6} />
        </Link>
      </div>
    </header>
  );
}

import { CircleUserRound, FolderKanban, Plus } from "lucide-react";
import Link from "next/link";

import { isLiveProcessingEnabled } from "../lib/live-processing";
import { BrandMark } from "./brand-mark";

export async function AppHeader() {
  const liveProcessingEnabled = isLiveProcessingEnabled();

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
          {liveProcessingEnabled ? "PUBLIC ACCESS" : "PORTFOLIO MODE"}
        </span>
        {liveProcessingEnabled ? (
          <Link
            aria-label="Open public workspace"
            className="grid h-10 w-10 place-items-center"
            href="/auth/guest"
          >
            <CircleUserRound aria-hidden="true" size={20} strokeWidth={1.6} />
          </Link>
        ) : (
          <span
            aria-label="Live access offline"
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

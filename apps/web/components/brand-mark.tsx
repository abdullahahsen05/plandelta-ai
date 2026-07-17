import Link from "next/link";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      aria-label="PlanDelta home"
      className="flex shrink-0 items-center gap-2.5 font-semibold tracking-[-0.01em]"
      href="/"
    >
      <span className="grid h-7 w-7 place-items-center bg-[#E6532F] text-[11px] font-bold text-white">
        Δ
      </span>
      <span className={compact ? "hidden sm:inline" : undefined}>PlanDelta</span>
    </Link>
  );
}

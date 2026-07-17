import Link from "next/link";

function RevisionPreview() {
  return (
    <div className="blueprint-grid relative min-h-[430px] overflow-hidden border-l border-white/10 text-white lg:min-h-[620px]">
      <div className="absolute inset-x-0 top-0 flex h-12 items-center justify-between border-b border-white/15 px-4">
        <span className="technical text-[11px] tracking-[0.12em] text-white/60">
          SAMPLE REVISION · A2.14
        </span>
        <span className="flex items-center gap-2 text-xs text-white/75">
          <span className="h-2 w-2 bg-[#17845B]" aria-hidden="true" /> Precomputed evidence
        </span>
      </div>

      <svg
        aria-label="Clearly labelled sample blueprint revision with highlighted evidence regions"
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 680 620"
        role="img"
      >
        <g fill="none" stroke="#DCE7EC" strokeWidth="2" opacity="0.88">
          <path d="M98 116H568V498H98Z" />
          <path d="M98 250H314V498M314 116V358H568M432 116V358" />
          <path d="M154 250v-48h66v48M432 206h54v-90" />
          <path d="M314 414h70v84M502 358v54h66" />
        </g>
        <g fill="none" stroke="#8EA8B9" strokeWidth="1" opacity="0.62">
          <path d="M82 116H65M82 250H65M76 116V250" />
          <path d="M98 96V76M314 96V76M98 84H314" />
          <circle cx="533" cy="456" r="23" />
          <path d="M518 456h30M533 441v30" />
        </g>
        <g className="technical" fill="#DCE7EC" fontSize="11" opacity="0.74">
          <text x="176" y="184">
            CONFERENCE 204
          </text>
          <text x="358" y="184">
            OFFICE 205
          </text>
          <text x="370" y="438">
            OPEN WORK 201
          </text>
          <text x="112" y="474">
            REV 04 · ISSUED FOR REVIEW
          </text>
        </g>
        <g fill="none" stroke="#17845B" strokeWidth="3">
          <path d="M145 193H230V264H145Z" strokeDasharray="8 5" />
          <path d="M136 184h103v89H136Z" opacity="0.38" />
        </g>
        <g fill="none" stroke="#D88916" strokeWidth="3">
          <path d="M419 330H516V386H419Z" strokeDasharray="8 5" />
        </g>
        <g fill="none" stroke="#C53F3F" strokeWidth="3">
          <path d="M296 399H398V444H296Z" strokeDasharray="8 5" />
        </g>
      </svg>

      <div className="absolute right-4 bottom-4 left-4 grid grid-cols-3 border border-white/15 bg-[#10263B]/95">
        {[
          ["Added", "03", "#17845B"],
          ["Modified", "02", "#D88916"],
          ["Removed", "01", "#C53F3F"],
        ].map(([label, value, color]) => (
          <div className="border-r border-white/10 px-3 py-3 last:border-r-0" key={label}>
            <div className="technical text-[10px] tracking-[0.12em] text-white/50">{label}</div>
            <div className="mt-1 flex items-center gap-2 text-lg">
              <span className="h-2 w-2" style={{ background: color }} aria-hidden="true" /> {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <header className="mx-auto flex h-14 max-w-[1280px] items-center justify-between border-x border-[#D8D4CA] px-4 sm:px-6">
        <Link className="flex items-center gap-3 font-semibold tracking-[-0.01em]" href="/">
          <span className="grid h-6 w-6 place-items-center bg-[#E6532F] text-[11px] font-bold text-white">
            Δ
          </span>
          PlanDelta
        </Link>
        <div className="flex items-center gap-5">
          <span className="technical hidden text-[10px] tracking-[0.1em] text-[#646762] sm:block">
            BLUEPRINT REVISION INTELLIGENCE
          </span>
          <Link className="border-b border-[#171A1C] text-sm font-semibold" href="/auth/sign-in">
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1280px] border border-[#D8D4CA] bg-[#FBFAF6] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex min-h-[540px] flex-col justify-between p-6 sm:p-10 lg:min-h-[620px] lg:p-14">
          <div>
            <div className="technical mb-12 flex items-center gap-3 text-[11px] font-medium tracking-[0.12em] text-[#646762]">
              <span className="h-px w-8 bg-[#E6532F]" /> REVISION REVIEW · EVIDENCE FIRST
            </div>
            <h1 className="max-w-[620px] text-[42px] leading-[0.98] font-[560] tracking-[-0.045em] text-balance sm:text-[56px]">
              See what changed before it changes the job.
            </h1>
            <p className="mt-7 max-w-[510px] text-[17px] leading-7 text-[#646762]">
              Align two drawing revisions, detect linework and note changes, and review every
              finding against its source evidence.
            </p>
          </div>

          <div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-11 items-center justify-center bg-[#E6532F] px-5 font-semibold text-white transition-colors hover:bg-[#C94325]"
                href="/app/analyses/sample"
              >
                Open labelled sample
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center border border-[#171A1C] px-5 font-semibold transition-colors hover:bg-[#171A1C] hover:text-white"
                href="/app/projects/new"
              >
                Compare revisions
              </Link>
            </div>
            <p className="mt-4 text-xs text-[#646762]">
              The sample uses committed evidence. Uploaded drawings run through the real CV/OCR
              pipeline.
            </p>
          </div>
        </div>

        <RevisionPreview />
      </section>

      <section className="mx-auto grid max-w-[1280px] border-x border-b border-[#D8D4CA] md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="border-b border-[#D8D4CA] p-6 md:border-r md:border-b-0">
          <span className="technical text-[10px] tracking-[0.12em] text-[#646762]">METHOD</span>
          <p className="mt-3 max-w-sm text-lg leading-6 font-medium">
            Deterministic vision first. AI summaries stay tied to the evidence.
          </p>
        </div>
        <div className="border-b border-[#D8D4CA] p-6 md:border-r md:border-b-0">
          <span className="technical text-[10px] tracking-[0.12em] text-[#646762]">
            TRACEABILITY
          </span>
          <p className="mt-3 text-sm leading-6 text-[#646762]">
            Every change links to normalized geometry, crops, OCR, confidence, and engine version.
          </p>
        </div>
        <div className="p-6">
          <span className="technical text-[10px] tracking-[0.12em] text-[#646762]">BOUNDARY</span>
          <p className="mt-3 text-sm leading-6 text-[#646762]">
            Decision support for revision review—not a guaranteed takeoff or cost estimate.
          </p>
        </div>
      </section>
    </main>
  );
}

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { UploadComparisonForm } from "../../../../components/upload-comparison-form";
import { isLiveProcessingEnabled } from "../../../../lib/live-processing";

export default function NewProjectPage() {
  const liveProcessingEnabled = isLiveProcessingEnabled();

  return (
    <main className="app-page app-page-narrow">
      <Link className="back-link" href="/app">
        <ArrowLeft aria-hidden="true" size={16} /> Projects
      </Link>
      <div className="app-page-heading">
        <div>
          <p className="eyebrow">NEW COMPARISON</p>
          <h1>Select two revisions</h1>
          <p>Use matching sheets and choose one page from each drawing for the MVP review.</p>
        </div>
      </div>

      {liveProcessingEnabled ? (
        <UploadComparisonForm />
      ) : (
        <section
          aria-labelledby="live-processing-offline"
          className="border border-[#D8D4CA] bg-[#FBFAF6] p-6 sm:p-8"
        >
          <p className="eyebrow">PORTFOLIO MODE</p>
          <h2 className="mt-3 text-2xl font-semibold" id="live-processing-offline">
            Live processing is temporarily offline
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#646762]">
            No upload will be accepted until the cost-controlled processing service is online.
            Review the labelled, precomputed sample in the meantime.
          </p>
          <Link
            className="signal-button mt-6 inline-flex min-h-11 items-center justify-center px-5"
            href="/app/analyses/sample"
          >
            Open labelled sample
          </Link>
        </section>
      )}
    </main>
  );
}

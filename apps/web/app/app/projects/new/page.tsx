import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { UploadComparisonForm } from "../../../../components/upload-comparison-form";

export default function NewProjectPage() {
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

      <UploadComparisonForm />
    </main>
  );
}

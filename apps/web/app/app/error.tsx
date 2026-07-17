"use client";

import { RotateCcw } from "lucide-react";

export default function ApplicationError({ reset }: { reset: () => void }) {
  return (
    <main className="app-page error-state">
      <p className="eyebrow">WORKSPACE UNAVAILABLE</p>
      <h1>The project view could not be loaded.</h1>
      <p>Your files were not changed. Retry the request or return to the projects list.</p>
      <button className="signal-button" onClick={reset} type="button">
        <RotateCcw aria-hidden="true" size={16} /> Retry
      </button>
    </main>
  );
}

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getSession: vi.fn() },
  }),
}));

import {
  EvidenceCopilot,
  SafeMarkdown,
} from "../components/evidence-copilot/evidence-copilot";
import { sampleChanges, sampleProject } from "../lib/sample-data";

describe("EvidenceCopilot", () => {
  it("labels cached sample output and focuses the cited drawing change", () => {
    const onSelectChange = vi.fn();
    render(
      <EvidenceCopilot
        analysisId={sampleProject.analysis.id}
        changes={sampleChanges}
        onSelectChange={onSelectChange}
        projectId={sampleProject.id}
        sample
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "What is the highest-confidence revision?",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask Evidence Copilot" }));

    expect(screen.getByText(/highest-confidence finding/i)).toBeInTheDocument();
    expect(screen.getAllByText("SAMPLE OUTPUT")).not.toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /Open citation 1/ }));
    expect(onSelectChange).toHaveBeenCalledWith(sampleChanges[0]!.id);
  });

  it("shows an editable, review-only RFI draft with no send action", () => {
    render(
      <EvidenceCopilot
        analysisId={sampleProject.analysis.id}
        changes={sampleChanges}
        onSelectChange={vi.fn()}
        projectId={sampleProject.id}
        sample
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Draft an RFI for the changed keynote." }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask Evidence Copilot" }));

    expect(screen.getByLabelText("Editable RFI draft")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Clarify revised note/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send rfi/i })).not.toBeInTheDocument();
  });

  it("renders raw HTML as inert text and only activates persisted citation markers", () => {
    const onCitation = vi.fn();
    render(
      <SafeMarkdown
        citations={[
          {
            id: "50000000-0000-4000-8000-000000000005",
            displayOrder: 1,
            citationType: "VISUAL_CHANGE",
            label: "Change #1",
            detectedChangeId: "60000000-0000-4000-8000-000000000006",
            pageNumber: null,
            sectionTitle: null,
            excerpt: null,
          },
        ]}
        content={"**Supported** <script>alert('x')</script> [1] [99]"}
        onCitation={onCitation}
      />,
    );

    expect(screen.getByText(/<script>alert\('x'\)<\/script>/)).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Open citation 1/ }));
    expect(onCitation).toHaveBeenCalledOnce();
    expect(screen.getByText(/Supported/).closest("p")).toHaveTextContent("[99]");
  });
});

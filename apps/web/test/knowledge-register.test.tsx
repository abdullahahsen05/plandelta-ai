import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getSession: vi.fn() },
  }),
}));

import { KnowledgeRegister } from "../components/knowledge-register";
import type { KnowledgeDocument } from "../lib/api/contracts";

const readyDocument: KnowledgeDocument = {
  id: "10000000-0000-4000-8000-000000000001",
  projectId: "20000000-0000-4000-8000-000000000002",
  originalName: "coordination-specification.pdf",
  detectedMimeType: "application/pdf",
  byteSize: 524288,
  checksumSha256: "a".repeat(64),
  documentType: "SPECIFICATION",
  status: "READY",
  failureCode: null,
  createdAt: "2026-07-19T08:00:00.000Z",
  updatedAt: "2026-07-19T08:01:00.000Z",
  activeVersion: {
    id: "30000000-0000-4000-8000-000000000003",
    revisionLabel: "Rev 04",
    effectiveDate: "2026-07-19T00:00:00.000Z",
    pageCount: 12,
    extractedCharacterCount: 4500,
    parserName: "pypdf",
    parserVersion: "6",
    chunkerVersion: "plandelta-structure-v1",
    embeddingProvider: "local",
    embeddingModel: "BAAI/bge-small-en-v1.5",
    embeddingDimension: 384,
    status: "READY",
    completedAt: "2026-07-19T08:01:00.000Z",
  },
  ingestionJobs: [
    {
      id: "40000000-0000-4000-8000-000000000004",
      documentVersionId: "30000000-0000-4000-8000-000000000003",
      status: "COMPLETED",
      progress: 100,
      currentStage: "completed",
      attemptCount: 0,
      maxAttempts: 3,
      failureCode: null,
      createdAt: "2026-07-19T08:00:00.000Z",
      updatedAt: "2026-07-19T08:01:00.000Z",
      completedAt: "2026-07-19T08:01:00.000Z",
    },
  ],
};

describe("KnowledgeRegister", () => {
  it("shows indexed source facts without inventing ingestion progress", () => {
    render(
      <KnowledgeRegister initialDocuments={[readyDocument]} projectId={readyDocument.projectId} />,
    );

    expect(screen.getByText("coordination-specification.pdf")).toBeInTheDocument();
    expect(screen.getByText("Rev 04")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review source" })).toHaveAttribute(
      "href",
      `/api/projects/${readyDocument.projectId}/knowledge-documents/${readyDocument.id}/source`,
    );
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("offers an explicit retry for a failed ingestion and exposes the safe failure code", () => {
    const failedDocument: KnowledgeDocument = {
      ...readyDocument,
      status: "FAILED",
      failureCode: "PDF_TEXT_EXTRACTION_FAILED",
      activeVersion: null,
      ingestionJobs: [
        {
          ...readyDocument.ingestionJobs[0]!,
          status: "FAILED",
          progress: 25,
          currentStage: "extracting",
          failureCode: "PDF_TEXT_EXTRACTION_FAILED",
          completedAt: null,
        },
      ],
    };

    render(
      <KnowledgeRegister
        initialDocuments={[failedDocument]}
        projectId={failedDocument.projectId}
      />,
    );

    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(screen.getByText("Code: PDF_TEXT_EXTRACTION_FAILED")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });
});

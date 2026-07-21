import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getSession: vi.fn() },
  }),
}));

import { UploadComparisonForm } from "../components/upload-comparison-form";

describe("UploadComparisonForm project evidence", () => {
  it("queues and removes supporting evidence before a comparison starts", () => {
    render(<UploadComparisonForm />);
    const input = screen.getByLabelText(/Add evidence documents/i);
    const specification = new File(["Door schedule: D-101 is 900 mm wide."], "door-schedule.txt", {
      type: "text/plain",
    });

    fireEvent.change(input, { target: { files: [specification] } });
    expect(screen.getByText("door-schedule.txt")).toBeInTheDocument();
    expect(screen.getByText(/Specification/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove door-schedule.txt" }));
    expect(screen.queryByText("door-schedule.txt")).not.toBeInTheDocument();
    expect(screen.getByText(/No documents queued/)).toBeInTheDocument();
  });

  it("rejects an unsupported evidence file before upload", () => {
    render(<UploadComparisonForm />);
    const input = screen.getByLabelText(/Add evidence documents/i);
    const image = new File(["not evidence"], "photo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [image] } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "photo.png must be a non-empty PDF or TXT file up to 20 MB.",
    );
    expect(screen.queryByText("photo.png")).not.toBeInTheDocument();
  });
});

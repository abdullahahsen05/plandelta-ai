import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Home from "../app/page";

const originalLiveProcessingValue = process.env.NEXT_PUBLIC_LIVE_PROCESSING_ENABLED;

afterEach(() => {
  if (originalLiveProcessingValue === undefined) {
    delete process.env.NEXT_PUBLIC_LIVE_PROCESSING_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_LIVE_PROCESSING_ENABLED = originalLiveProcessingValue;
  }
});

describe("marketing entry", () => {
  it("labels the built-in sample and the real upload path", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "Open labelled sample" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compare revisions" })).toBeInTheDocument();
    expect(
      screen.getByText(/uploaded drawings run through the real CV\/OCR pipeline/i),
    ).toBeInTheDocument();
  });

  it("does not present live processing as available when portfolio mode is enabled", () => {
    process.env.NEXT_PUBLIC_LIVE_PROCESSING_ENABLED = "false";
    render(<Home />);

    expect(screen.getByRole("button", { name: "Live processing offline" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Compare revisions" })).not.toBeInTheDocument();
    expect(screen.getByText(/temporary live compute is offline/i)).toBeInTheDocument();
  });
});

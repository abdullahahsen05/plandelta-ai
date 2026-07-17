import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "../app/page";

describe("marketing entry", () => {
  it("labels the built-in sample and the real upload path", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "Open labelled sample" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compare revisions" })).toBeInTheDocument();
    expect(
      screen.getByText(/uploaded drawings run through the real CV\/OCR pipeline/i),
    ).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import SignInPage from "../app/auth/sign-in/page";

const originalLiveProcessingValue = process.env.NEXT_PUBLIC_LIVE_PROCESSING_ENABLED;

afterEach(() => {
  if (originalLiveProcessingValue === undefined) {
    delete process.env.NEXT_PUBLIC_LIVE_PROCESSING_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_LIVE_PROCESSING_ENABLED = originalLiveProcessingValue;
  }
});

describe("sign-in boundary", () => {
  it("does not offer passwordless sign-in while portfolio mode is active", async () => {
    process.env.NEXT_PUBLIC_LIVE_PROCESSING_ENABLED = "false";

    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "Live project access is temporarily offline" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Work email" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the labelled sample" })).toBeInTheDocument();
  });
});

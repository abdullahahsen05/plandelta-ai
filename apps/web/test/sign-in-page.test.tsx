import { beforeEach, describe, expect, it, vi } from "vitest";

import SignInPage from "../app/auth/sign-in/page";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => {
  return { redirect: redirectMock };
});

describe("sign-in boundary", () => {
  beforeEach(() => redirectMock.mockReset());

  it("redirects legacy sign-in traffic into an isolated guest session", async () => {
    await SignInPage({ searchParams: Promise.resolve({ next: "/app/projects/new" }) });

    expect(redirectMock).toHaveBeenCalledWith("/auth/guest?next=%2Fapp%2Fprojects%2Fnew");
  });
});

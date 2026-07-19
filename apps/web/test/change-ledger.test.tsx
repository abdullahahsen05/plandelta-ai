import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChangeLedger } from "../components/change-ledger";
import { sampleChanges } from "../lib/sample-data";

describe("ChangeLedger", () => {
  it("filters semantic change types without hiding the selected evidence detail", () => {
    const onFilterChange = vi.fn();

    render(
      <ChangeLedger
        changes={sampleChanges}
        filter="all"
        onFilterChange={onFilterChange}
        onSelect={vi.fn()}
        selectedId={sampleChanges[0]!.id}
      />,
    );

    expect(screen.getByRole("heading", { name: sampleChanges[0]!.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Removed" }));
    expect(onFilterChange).toHaveBeenCalledWith("removed");
  });

  it("exposes each canvas region through a keyboard-operable ledger row", () => {
    const onSelect = vi.fn();

    render(
      <ChangeLedger
        changes={sampleChanges}
        filter="all"
        onFilterChange={vi.fn()}
        onSelect={onSelect}
        selectedId={sampleChanges[0]!.id}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Door swing and opening revised/ }));
    expect(onSelect).toHaveBeenCalledWith("chg-door-02");
  });
});

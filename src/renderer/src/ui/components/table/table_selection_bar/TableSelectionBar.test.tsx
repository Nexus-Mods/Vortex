import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { TableSelectionBar } from "./TableSelectionBar";

describe("TableSelectionBar", () => {
  it("says how many are selected, with what can be done with them", () => {
    render(
      <TableSelectionBar count={2} onClear={vi.fn()}>
        <button type="button">Remove</button>
      </TableSelectionBar>,
    );

    // the test `t` leaves the count uninterpolated
    const bar = screen.getByRole("region", { name: "{{count}} selected" });
    expect(bar).toHaveTextContent("{{count}} selected");
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("deselects them all from the button with the count", async () => {
    const onClear = vi.fn();
    render(<TableSelectionBar count={1} onClear={onClear} />);

    await userEvent.click(screen.getByRole("button", { name: "Deselect all" }));

    expect(onClear).toHaveBeenCalled();
  });
});

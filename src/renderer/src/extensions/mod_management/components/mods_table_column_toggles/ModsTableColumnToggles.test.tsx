import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ModsTableColumnToggles } from "./ModsTableColumnToggles";

const TOGGLES = [
  { id: "version", header: "Version", visible: true },
  { id: "author", header: "Author", visible: false },
];

describe("ModsTableColumnToggles", () => {
  it("shows a pressed button for each column on, and unpressed for each off", () => {
    render(<ModsTableColumnToggles toggles={TOGGLES} onToggle={vi.fn()} />);

    const group = screen.getByRole("group", { name: "Toggle columns" });
    expect(within(group).getByRole("button", { name: "Version" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(group).getByRole("button", { name: "Author" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("toggles a column", async () => {
    const onToggle = vi.fn();
    render(<ModsTableColumnToggles toggles={TOGGLES} onToggle={onToggle} />);

    await userEvent.click(screen.getByRole("button", { name: "Version" }));
    await userEvent.click(screen.getByRole("button", { name: "Author" }));

    expect(onToggle.mock.calls).toEqual([
      ["version", false],
      ["author", true],
    ]);
  });

  it("leaves the section out when there's nothing to toggle", () => {
    const { container } = render(<ModsTableColumnToggles toggles={[]} onToggle={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});

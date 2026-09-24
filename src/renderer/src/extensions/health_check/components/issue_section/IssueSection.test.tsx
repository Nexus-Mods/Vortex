import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { IssueSection } from "./IssueSection";

const renderSection = () =>
  render(
    <IssueSection
      actions={<button type="button">Hide all</button>}
      count={2}
      description="Issues that may stop parts of your loadout from working."
      title="Warnings"
    >
      <div>Row one</div>

      <div>Row two</div>
    </IssueSection>,
  );

describe("IssueSection", () => {
  it("shows the title, count, actions and rows", () => {
    renderSection();

    // the count sits beside the title, in the same line
    expect(screen.getByText("Warnings").parentElement).toHaveTextContent(/^Warnings\s*2$/);
    expect(screen.getByRole("button", { name: "Hide all" })).toBeVisible();
    expect(screen.getByText("Row one")).toBeVisible();
  });

  it("collapses and expands the rows, keeping the actions", () => {
    renderSection();
    const toggle = screen.getByRole("button", { expanded: true });

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Row one")).not.toBeVisible();
    expect(screen.getByRole("button", { name: "Hide all" })).toBeVisible();

    fireEvent.click(toggle);

    expect(screen.getByText("Row one")).toBeVisible();
  });
});

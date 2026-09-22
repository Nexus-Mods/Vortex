import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";

import { Section } from "./Section";

// --- Helpers ---

type SectionProps = React.ComponentProps<typeof Section>;

const renderComponent = (props: Partial<SectionProps> = {}) =>
  render(
    <Section
      {...({ children: <p>Body</p>, count: "2", title: "Managed", ...props } as SectionProps)}
    />,
  );

// --- Tests ---

describe("Section", () => {
  it("renders the title and its content", () => {
    renderComponent();
    expect(screen.getByText("Managed")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  // The content is always visible now the section no longer collapses, so there is
  // nothing for a reader to expand and no control offering to.
  it("exposes no toggle and keeps the content mounted", () => {
    renderComponent();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(document.querySelector("[aria-expanded]")).toBeNull();
  });

  // A string, so a filtered section can show "2/7" rather than just the visible tally.
  it("renders the count", () => {
    renderComponent({ count: "2/7" });
    expect(screen.getByText("2/7")).toBeInTheDocument();
  });

  it("renders a zero count rather than hiding it", () => {
    renderComponent({ count: "0" });
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders the description and actions", () => {
    renderComponent({
      actions: <button type="button">Scan again</button>,
      description: "Game not detected? Add your game manually.",
    });

    expect(screen.getByText("Game not detected? Add your game manually.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scan again" })).toBeInTheDocument();
  });

  // Pagination scrolls the unmanaged section back to the top of the viewport off this node.
  it("hands a ref to the section element", () => {
    const ref = React.createRef<HTMLDivElement>();
    renderComponent({ className: "managed", ref });
    expect(ref.current).toBe(document.querySelector("section.managed"));
  });
});

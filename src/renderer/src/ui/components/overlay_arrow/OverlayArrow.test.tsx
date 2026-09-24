import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { Tooltip } from "@/ui/components/tooltip/Tooltip";

import { OverlayArrow, type OverlayArrowSide } from "./OverlayArrow";

// --- Helpers ---

const renderArrow = (side: OverlayArrowSide = "right", tipFromEnd = 24) => {
  const { container } = render(<OverlayArrow side={side} tipFromEnd={tipFromEnd} />);
  const svg = container.querySelector("svg");

  return { path: svg?.querySelector("path"), svg };
};

// --- Tests ---

describe("OverlayArrow", () => {
  it("draws the shape the tooltip's own arrow draws", () => {
    // What notices if Floating UI ever changes its arrow geometry.
    render(
      <Tooltip content="Downloading Eastern Vagabond Armor" open placement="right">
        <button type="button">Downloads</button>
      </Tooltip>,
    );
    const fromTooltip = document
      .querySelector("#overlays .nxm-overlay-arrow path")
      ?.getAttribute("d");

    const { path } = renderArrow();

    expect(fromTooltip).toBeTruthy();
    expect(path?.getAttribute("d")).toBe(fromTooltip);
  });

  it("carries the shared class, so both are painted by one rule", () => {
    const { svg } = renderArrow();
    expect(svg).toHaveClass("nxm-overlay-arrow");
  });

  it("centres its tip on the offset rather than hanging its corner there", () => {
    // The box is 14 across once rotated, so its edge sits half of that back.
    const { svg } = renderArrow("right", 24);
    expect(svg).toHaveStyle({ bottom: "17px" });
  });

  it("sits just outside the panel edge, so the outline meets its border", () => {
    const { svg } = renderArrow("right");
    expect(svg).toHaveStyle({ right: "calc(100% - 1px)" });
  });

  it.each([
    ["right", "rotate(90deg)"],
    ["left", "rotate(-90deg)"],
    ["bottom", "rotate(180deg)"],
  ] as Array<[OverlayArrowSide, string]>)("turns to point back at a %s trigger", (side, turn) => {
    const { svg } = renderArrow(side);
    expect(svg).toHaveStyle({ transform: turn });
  });

  it("measures a top-side arrow across the other axis", () => {
    const { svg } = renderArrow("top", 24);
    expect(svg).toHaveStyle({ right: "17px", top: "100%" });
  });

  it("is hidden from assistive tech, being pure decoration", () => {
    const { svg } = renderArrow();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("outlines only its slanted edges, leaving the base against the panel", () => {
    const { svg } = renderArrow();
    const clipped = svg?.querySelector("path[clip-path]");

    expect(clipped).toBeInTheDocument();
    expect(svg?.querySelector("clipPath")).toBeInTheDocument();
  });
});

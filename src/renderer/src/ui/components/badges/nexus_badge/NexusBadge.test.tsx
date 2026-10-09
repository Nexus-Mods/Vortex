import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";

import { NexusBadge } from "./NexusBadge";

const getBadge = () => document.querySelector("svg");

describe("NexusBadge", () => {
  it("draws the logo, hidden from assistive tech beside the label it decorates", () => {
    render(<NexusBadge />);

    expect(getBadge()).toHaveAttribute("aria-hidden", "true");
    expect(getBadge()?.querySelectorAll("path")).toHaveLength(10);
  });

  it("keeps the logo's own colours", () => {
    render(<NexusBadge />);

    const fills = new Set(
      Array.from(getBadge()?.querySelectorAll("path") ?? [], (path) => path.getAttribute("fill")),
    );
    expect(fills).toEqual(new Set(["#1D1D21", "#D98F40", "#F4F4F5"]));
  });

  it("is 16px by default, and merges a custom className", () => {
    render(<NexusBadge className="size-8" />);

    expect(getBadge()).toHaveClass("size-4", "shrink-0", "size-8");
  });
});

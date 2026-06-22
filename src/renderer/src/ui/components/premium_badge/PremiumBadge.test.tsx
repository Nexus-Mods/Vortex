import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";

import { PremiumBadge } from "./PremiumBadge";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

// --- Tests ---

describe("PremiumBadge", () => {
  it("renders an icon inside a badge span", () => {
    const { container } = render(<PremiumBadge />);
    const span = container.querySelector("span");
    expect(span).toBeInTheDocument();
    expect(screen.getByRole("presentation").tagName).toBe("svg");
  });

  it("applies the premium background base classes", () => {
    const { container } = render(<PremiumBadge />);
    expect(container.querySelector("span")).toHaveClass("bg-premium-moderate");
  });

  it("merges a custom className", () => {
    const { container } = render(<PremiumBadge className="my-class" />);
    expect(container.querySelector("span")).toHaveClass("bg-premium-moderate", "my-class");
  });
});

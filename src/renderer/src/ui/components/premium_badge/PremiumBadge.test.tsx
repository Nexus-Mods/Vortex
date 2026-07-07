import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";

import { PremiumBadge } from "./PremiumBadge";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const getBadge = () => document.querySelector("span");

// --- Tests ---

describe("PremiumBadge", () => {
  it("renders an icon inside a badge span", () => {
    render(<PremiumBadge />);
    expect(getBadge()).toBeInTheDocument();
    expect(screen.getByRole("presentation").tagName).toBe("svg");
  });

  it("applies the premium background base classes", () => {
    render(<PremiumBadge />);
    expect(getBadge()).toHaveClass("bg-premium-moderate");
  });

  it("merges a custom className", () => {
    render(<PremiumBadge className="my-class" />);
    expect(getBadge()).toHaveClass("bg-premium-moderate", "my-class");
  });
});

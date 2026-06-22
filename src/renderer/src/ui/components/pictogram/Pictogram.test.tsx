import { render, cleanup } from "@testing-library/react";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";

import { Pictogram } from "./Pictogram";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const getSvg = () => document.querySelector("svg");

// --- Tests ---

describe("Pictogram", () => {
  describe("rendering", () => {
    it("renders an svg referencing the named pictogram asset", () => {
      render(<Pictogram name="tools" />);
      const use = getSvg()?.querySelector("use");
      expect(use).toHaveAttribute("href", "assets/pictograms/tools.svg");
    });

    it("always applies the shrink-0 base class", () => {
      render(<Pictogram name="health-check" />);
      expect(getSvg()).toHaveClass("shrink-0");
    });
  });

  describe("size", () => {
    it.each([
      ["4xs", "size-4"],
      ["2xs", "size-9"],
      ["md", "size-20"],
      ["2xl", "size-40"],
    ] as const)("applies %s -> %s", (size, cls) => {
      render(<Pictogram name="tools" size={size} />);
      expect(getSvg()).toHaveClass(cls);
    });

    it("defaults to md (size-20)", () => {
      render(<Pictogram name="tools" />);
      expect(getSvg()).toHaveClass("size-20");
    });
  });

  describe("theme", () => {
    it.each([
      ["creator", "text-creator-moderate"],
      ["info", "text-info-moderate"],
      ["premium", "text-premium-moderate"],
      ["primary", "text-primary-moderate"],
    ] as const)("applies %s -> %s", (theme, cls) => {
      render(<Pictogram name="tools" theme={theme} />);
      expect(getSvg()).toHaveClass(cls);
    });

    it("defaults to the primary theme colour", () => {
      render(<Pictogram name="tools" />);
      expect(getSvg()).toHaveClass("text-primary-moderate");
    });

    it('applies no theme colour class for theme="none"', () => {
      render(<Pictogram name="tools" theme="none" />);
      expect(getSvg()?.getAttribute("class")).not.toMatch(/text-(creator|info|premium|primary)-/);
    });
  });

  describe("pass-through", () => {
    it("merges a custom className", () => {
      render(<Pictogram className="my-class" name="tools" />);
      expect(getSvg()).toHaveClass("shrink-0", "my-class");
    });

    it("forwards arbitrary svg attributes", () => {
      render(<Pictogram data-testid="pictogram" name="tools" />);
      expect(document.querySelector('[data-testid="pictogram"]')).toBeInTheDocument();
    });
  });
});

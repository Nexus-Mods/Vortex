import { render, cleanup } from "@testing-library/react";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";

import { Pictogram } from "./Pictogram";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const renderComponent = (props: Partial<React.ComponentProps<typeof Pictogram>> = {}) => {
  const name = props.name ?? "tools";

  render(<Pictogram name={name} {...props} />);

  return { name };
};

const getSvg = () => document.querySelector("svg");

// --- Tests ---

describe("Pictogram", () => {
  describe("rendering", () => {
    it("renders an svg referencing the named pictogram asset", () => {
      const { name } = renderComponent();
      expect(getSvg()?.querySelector("use")).toHaveAttribute(
        "href",
        `assets/pictograms/${name}.svg`,
      );
    });

    it("always applies the shrink-0 base class", () => {
      renderComponent({ name: "health-check" });
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
      renderComponent({ size });
      expect(getSvg()).toHaveClass(cls);
    });

    it("defaults to md (size-20)", () => {
      renderComponent();
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
      renderComponent({ theme });
      expect(getSvg()).toHaveClass(cls);
    });

    it("defaults to the primary theme colour", () => {
      renderComponent();
      expect(getSvg()).toHaveClass("text-primary-moderate");
    });

    it('applies no theme colour class for theme="none"', () => {
      renderComponent({ theme: "none" });
      expect(getSvg()?.getAttribute("class")).not.toMatch(/text-(creator|info|premium|primary)-/);
    });
  });

  describe("pass-through", () => {
    it("merges a custom className", () => {
      renderComponent({ className: "my-class" });
      expect(getSvg()).toHaveClass("shrink-0", "my-class");
    });

    it("forwards arbitrary svg attributes", () => {
      renderComponent({ id: "pictogram" });
      expect(document.querySelector("#pictogram")).toBeInTheDocument();
    });
  });
});

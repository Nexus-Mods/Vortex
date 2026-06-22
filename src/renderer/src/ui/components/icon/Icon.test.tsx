import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";

import { Icon } from "./Icon";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const renderComponent = (props: Partial<React.ComponentProps<typeof Icon>> = {}) => {
  const path = "M0 0h24v24H0z";

  render(<Icon path={path} {...props} />);

  return { path };
};

// --- Tests ---

describe("Icon", () => {
  describe("rendering", () => {
    it("renders an svg element", () => {
      renderComponent();
      expect(screen.getByRole("presentation").tagName).toBe("svg");
    });

    it("renders the path data with currentColor fill", () => {
      const { path } = renderComponent();
      const el = document.querySelector("path");
      expect(el).toHaveAttribute("d", path);
      expect(el).toHaveAttribute("fill", "currentColor");
    });

    it("always applies the shrink-0 base class", () => {
      renderComponent();
      expect(screen.getByRole("presentation")).toHaveClass("shrink-0");
    });
  });

  describe("accessibility role", () => {
    it('is presentational (role="presentation") with no title', () => {
      renderComponent();
      expect(screen.getByRole("presentation")).toBeInTheDocument();
    });

    it('exposes role="img" and a <title> when a title is given', () => {
      renderComponent({ title: "Home" });
      const svg = screen.getByRole("img", { name: "Home" });
      expect(svg).toBeInTheDocument();
      expect(svg.querySelector("title")?.textContent).toBe("Home");
    });
  });

  describe("size", () => {
    it.each([
      ["xs", "size-3"],
      ["sm", "size-4"],
      ["md", "size-5"],
      ["lg", "size-6"],
      ["xl", "size-8"],
      ["2xl", "size-12"],
    ] as const)("applies %s -> %s", (size, cls) => {
      renderComponent({ size });
      expect(screen.getByRole("presentation")).toHaveClass(cls);
    });

    it("defaults to md (size-5)", () => {
      renderComponent();
      expect(screen.getByRole("presentation")).toHaveClass("size-5");
    });

    it('applies no size class for size="none"', () => {
      renderComponent({ size: "none" });
      expect(screen.getByRole("presentation").getAttribute("class")).not.toMatch(/\bsize-\d/);
    });
  });

  describe("pass-through", () => {
    it("merges a custom className", () => {
      renderComponent({ className: "text-danger-strong" });
      expect(screen.getByRole("presentation")).toHaveClass("shrink-0", "text-danger-strong");
    });

    it("forwards arbitrary svg attributes", () => {
      renderComponent({ id: "icon" });
      expect(document.querySelector("#icon")).toBeInTheDocument();
    });
  });
});

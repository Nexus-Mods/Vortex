import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";

import { Icon } from "./Icon";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const PATH = "M0 0h24v24H0z";

// --- Tests ---

describe("Icon", () => {
  describe("rendering", () => {
    it("renders an svg element", () => {
      render(<Icon path={PATH} />);
      const svg = screen.getByRole("presentation");
      expect(svg.tagName).toBe("svg");
    });

    it("renders the path data with currentColor fill", () => {
      const { container } = render(<Icon path={PATH} />);
      const path = container.querySelector("path");
      expect(path).toHaveAttribute("d", PATH);
      expect(path).toHaveAttribute("fill", "currentColor");
    });

    it("always applies the shrink-0 base class", () => {
      render(<Icon path={PATH} />);
      expect(screen.getByRole("presentation")).toHaveClass("shrink-0");
    });
  });

  describe("accessibility role", () => {
    it('is presentational (role="presentation") with no title', () => {
      render(<Icon path={PATH} />);
      expect(screen.getByRole("presentation")).toBeInTheDocument();
    });

    it('exposes role="img" and a <title> when a title is given', () => {
      render(<Icon path={PATH} title="Home" />);
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
      render(<Icon path={PATH} size={size} />);
      expect(screen.getByRole("presentation")).toHaveClass(cls);
    });

    it("defaults to md (size-5)", () => {
      render(<Icon path={PATH} />);
      expect(screen.getByRole("presentation")).toHaveClass("size-5");
    });

    it('applies no size class for size="none"', () => {
      render(<Icon path={PATH} size="none" />);
      const svg = screen.getByRole("presentation");
      expect(svg.getAttribute("class")).not.toMatch(/\bsize-\d/);
    });
  });

  describe("pass-through", () => {
    it("merges a custom className", () => {
      render(<Icon className="text-danger-strong" path={PATH} />);
      expect(screen.getByRole("presentation")).toHaveClass("shrink-0", "text-danger-strong");
    });

    it("forwards arbitrary svg attributes", () => {
      render(<Icon data-testid="icon" path={PATH} />);
      expect(screen.getByTestId("icon")).toBeInTheDocument();
    });
  });
});

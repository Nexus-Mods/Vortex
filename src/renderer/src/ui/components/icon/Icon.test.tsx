import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";

import { Icon, IconSlot, type IPathIconProps, type ISymbolIconProps } from "./Icon";

// --- Helpers ---

const renderComponent = (props: Partial<IPathIconProps> = {}) => {
  const path = "M0 0h24v24H0z";

  render(<Icon path={path} {...props} />);

  return { path };
};

const renderSymbol = (props: Partial<ISymbolIconProps> = {}) => {
  const { container } = render(<Icon name="home" {...props} />);

  return container.querySelector("span");
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

    it("always applies the nxm-icon class", () => {
      renderComponent();
      expect(screen.getByRole("presentation")).toHaveClass("nxm-icon");
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
      expect(screen.getByRole("presentation")).toHaveClass("nxm-icon", "text-danger-strong");
    });

    it("forwards arbitrary svg attributes", () => {
      renderComponent({ id: "icon" });
      expect(document.querySelector("#icon")).toBeInTheDocument();
    });
  });
  describe("symbol", () => {
    it("gives the symbol's name for the font to draw, outside the page's text", () => {
      const el = renderSymbol({ name: "settings" });
      expect(el).toHaveAttribute("data-symbol", "settings");
      expect(el).toBeEmptyDOMElement();
      expect(el).toHaveClass("nxm-icon", "nxm-icon-symbol");
      expect(document.querySelector("svg")).not.toBeInTheDocument();
    });

    it("is hidden from assistive technology with no title", () => {
      const el = renderSymbol();
      expect(el).toHaveAttribute("aria-hidden", "true");
      expect(el).not.toHaveAttribute("role");
    });

    it('exposes role="img" and the title as its label when a title is given', () => {
      renderSymbol({ title: "Home" });
      const el = screen.getByRole("img", { name: "Home" });
      expect(el).not.toHaveAttribute("aria-hidden");
    });

    it('exposes role="img" when given an aria-label instead of a title', () => {
      renderSymbol({ "aria-label": "Home" });
      const el = screen.getByRole("img", { name: "Home" });
      expect(el).not.toHaveAttribute("aria-hidden");
    });

    it.each([
      ["xs", "size-3", "text-[0.75rem]"],
      ["sm", "size-4", "text-[1rem]"],
      ["md", "size-5", "text-[1.25rem]"],
      ["lg", "size-6", "text-[1.5rem]"],
      ["xl", "size-8", "text-[2rem]"],
      ["2xl", "size-12", "text-[3rem]"],
    ] as const)("sizes %s as %s with a %s font", (size, box, font) => {
      expect(renderSymbol({ size })).toHaveClass(box, font);
    });

    it("defaults to md", () => {
      expect(renderSymbol()).toHaveClass("size-5", "text-[1.25rem]");
    });

    it('takes the size of the text around it for size="none"', () => {
      const className = renderSymbol({ size: "none" }).getAttribute("class");
      expect(className).not.toMatch(/\bsize-\d/);
      expect(className).not.toMatch(/text-\[/);
    });

    it("sets no font axes unless asked", () => {
      const el = renderSymbol();
      expect(el.style.fontVariationSettings).toBeFalsy();
      expect(el.style.fontWeight).toBeFalsy();
    });

    it("sets the fill axis", () => {
      expect(renderSymbol({ filled: true }).style.fontVariationSettings).toBe('"FILL" 1');
      expect(renderSymbol({ filled: false }).style.fontVariationSettings).toBe('"FILL" 0');
    });

    it("sets the grade axis alongside fill", () => {
      expect(renderSymbol({ filled: true, grade: 200 }).style.fontVariationSettings).toBe(
        '"FILL" 1, "GRAD" 200',
      );
    });

    it("sets the optical size axis", () => {
      expect(renderSymbol({ opticalSize: 48 }).style.fontVariationSettings).toBe('"opsz" 48');
    });

    it("sets every axis it is given, in one declaration", () => {
      const el = renderSymbol({ filled: true, grade: -25, opticalSize: 20 });
      expect(el.style.fontVariationSettings).toBe('"FILL" 1, "GRAD" -25, "opsz" 20');
    });

    it("sets the weight axis through the font weight", () => {
      expect(renderSymbol({ weight: 300 }).style.fontWeight).toBe("300");
    });

    it("lets a style prop add to the axes", () => {
      const el = renderSymbol({ filled: true, style: { opacity: 0.5 } });
      expect(el.style.fontVariationSettings).toBe('"FILL" 1');
      expect(el.style.opacity).toBe("0.5");
    });

    it("merges a custom className and forwards other attributes", () => {
      const el = renderSymbol({ className: "text-danger-strong", id: "symbol" });
      expect(el).toHaveClass("nxm-icon-symbol", "text-danger-strong");
      expect(el).toHaveAttribute("id", "symbol");
    });
  });
  describe("IconSlot", () => {
    it("draws a symbol with the class and size it is given", () => {
      const { container } = render(<IconSlot className="slot" icon="settings" size="sm" />);
      expect(container.querySelector("[data-symbol='settings']")).toHaveClass("slot", "size-4");
    });

    it("draws an SVG path", () => {
      const { container } = render(<IconSlot className="slot" icon={{ path: "M0 0h24v24H0z" }} />);
      expect(container.querySelector("svg")).toHaveClass("slot");
    });

    it("puts an element in an icon box with the class", () => {
      render(<IconSlot className="slot" icon={<i data-testid="node" />} />);
      expect(screen.getByTestId("node").parentElement).toHaveClass("nxm-icon", "slot");
    });

    it("draws nothing for no icon", () => {
      const { container } = render(<IconSlot className="slot" />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});

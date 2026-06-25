import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Button } from "./Button";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const getButton = () => screen.getByRole("button", { name: /click/i });

// --- Tests ---

describe("Button", () => {
  describe("rendering", () => {
    it("renders a button element", () => {
      render(<Button>Click me</Button>);
      expect(getButton()).toBeInTheDocument();
    });

    it("renders children in a span", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText("Click me")).toBeInTheDocument();
    });

    it("renders customContent instead of children when provided", () => {
      render(<Button customContent={<div data-testid="custom">custom</div>}>ignored</Button>);
      expect(screen.getByTestId("custom")).toBeInTheDocument();
      expect(screen.queryByText("ignored")).not.toBeInTheDocument();
    });

    it("renders nothing inside button when neither children nor customContent", () => {
      render(<Button aria-label="empty" />);
      expect(screen.getByRole("button", { name: /empty/i })).toBeEmptyDOMElement();
    });
  });

  describe("default props", () => {
    it('defaults to type="button" to avoid accidental form submissions', () => {
      render(<Button>Click</Button>);
      expect(getButton()).toHaveAttribute("type", "button");
    });

    it("applies primary brand class by default", () => {
      render(<Button>Click</Button>);
      expect(getButton()).toHaveClass("nxm-button-primary");
    });

    it("applies strong appearance class by default", () => {
      render(<Button>Click</Button>);
      expect(getButton()).toHaveClass("nxm-button-strong");
    });

    it("applies nxm-button base class always", () => {
      render(<Button>Click</Button>);
      expect(getButton()).toHaveClass("nxm-button");
    });
  });

  describe("brand", () => {
    it.each([
      ["primary", "nxm-button-primary"],
      ["info", "nxm-button-info"],
      ["neutral", "nxm-button-neutral"],
      ["success", "nxm-button-success"],
      ["premium", "nxm-button-premium"],
    ] as const)('applies correct class for brand="%s"', (brand, cls) => {
      render(<Button brand={brand}>Click</Button>);
      expect(getButton()).toHaveClass(cls);
    });
  });

  describe("appearance", () => {
    it.each([
      ["weak", "nxm-button-weak"],
      ["subdued", "nxm-button-subdued"],
      ["moderate", "nxm-button-moderate"],
      ["strong", "nxm-button-strong"],
    ] as const)('applies correct class for appearance="%s"', (appearance, cls) => {
      render(<Button appearance={appearance}>Click</Button>);
      expect(getButton()).toHaveClass(cls);
    });

    it("combines brand and appearance classes", () => {
      render(
        <Button appearance="subdued" brand="neutral">
          Click
        </Button>,
      );
      expect(getButton()).toHaveClass("nxm-button-neutral", "nxm-button-subdued");
    });
  });

  describe("size", () => {
    it('applies xs class for size="xs"', () => {
      render(<Button size="xs">Click</Button>);
      expect(getButton()).toHaveClass("nxm-button-xs");
    });

    it('applies sm class for size="sm"', () => {
      render(<Button size="sm">Click</Button>);
      expect(getButton()).toHaveClass("nxm-button-sm");
    });

    it('does not apply size class for size="md" (default)', () => {
      render(<Button>Click</Button>);
      expect(getButton()).not.toHaveClass("nxm-button-xs");
      expect(getButton()).not.toHaveClass("nxm-button-sm");
    });
  });

  describe("disabled state", () => {
    it("sets disabled attribute when disabled=true", () => {
      render(<Button disabled={true}>Click</Button>);
      expect(getButton()).toBeDisabled();
    });

    it("applies disabled class when disabled=true", () => {
      render(<Button disabled={true}>Click</Button>);
      expect(getButton()).toHaveClass("nxm-button-disabled");
    });

    it("applies disabled class when aria-disabled=true", () => {
      render(<Button aria-disabled={true}>Click</Button>);
      expect(getButton()).toHaveClass("nxm-button-disabled");
    });

    it("does not set disabled attribute when only aria-disabled (stays focusable)", () => {
      render(<Button aria-disabled={true}>Click</Button>);
      expect(getButton()).not.toBeDisabled();
    });
  });

  describe("isLoading", () => {
    it("disables the button when isLoading=true", () => {
      render(<Button isLoading={true}>Click</Button>);
      expect(getButton()).toBeDisabled();
    });

    it("applies disabled class when isLoading=true", () => {
      render(<Button isLoading={true}>Click</Button>);
      expect(getButton()).toHaveClass("nxm-button-disabled");
    });

    it("renders two icons (circle + spinner) when isLoading=true", () => {
      render(<Button isLoading={true}>Click</Button>);
      // ButtonIcon in loading state renders two SVG icons
      expect(screen.getAllByRole("presentation")).toHaveLength(2);
    });
  });

  describe("icon-only", () => {
    it("applies icon-only class when no children or customContent", () => {
      render(<Button aria-label="icon only" leftIconPath="some-path" />);
      expect(screen.getByRole("button", { name: /icon only/i })).toHaveClass(
        "nxm-button-icon-only",
      );
    });

    it("does not apply icon-only class when children are present", () => {
      render(<Button leftIconPath="some-path">Click</Button>);
      expect(getButton()).not.toHaveClass("nxm-button-icon-only");
    });
  });

  describe("icons", () => {
    it("renders left icon from path", () => {
      render(<Button leftIconPath="mdi-home">Click</Button>);
      expect(screen.getByRole("presentation")).toBeInTheDocument();
    });

    it("renders left icon from ReactNode", () => {
      render(<Button leftIcon={<span data-testid="left-icon" />}>Click</Button>);
      expect(screen.getByTestId("left-icon")).toBeInTheDocument();
    });

    it("renders right icon from path", () => {
      render(<Button rightIconPath="mdi-arrow">Click</Button>);
      expect(screen.getByRole("presentation")).toBeInTheDocument();
    });

    it("renders right icon from ReactNode", () => {
      render(<Button rightIcon={<span data-testid="right-icon" />}>Click</Button>);
      expect(screen.getByTestId("right-icon")).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("calls onClick when clicked", async () => {
      const onClick = vi.fn();
      render(<Button onClick={onClick}>Click</Button>);
      await userEvent.click(getButton());
      expect(onClick).toHaveBeenCalledOnce();
    });

    it("does not call onClick when disabled", async () => {
      const onClick = vi.fn();
      render(
        <Button disabled={true} onClick={onClick}>
          Click
        </Button>,
      );
      await userEvent.click(getButton());
      expect(onClick).not.toHaveBeenCalled();
    });

    it("does not call onClick when isLoading", async () => {
      const onClick = vi.fn();
      render(
        <Button isLoading={true} onClick={onClick}>
          Click
        </Button>,
      );
      await userEvent.click(getButton());
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("forwarded ref", () => {
    it("forwards ref to the button element", () => {
      const ref = vi.fn();
      render(<Button ref={ref}>Click</Button>);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
    });
  });

  describe("extra props", () => {
    it("passes through arbitrary HTML attributes", () => {
      render(
        <Button aria-label="submit" data-testid="my-button">
          Click
        </Button>,
      );
      expect(screen.getByTestId("my-button")).toHaveAttribute("aria-label", "submit");
    });

    it("respects an explicit type override", () => {
      render(<Button type="submit">Click</Button>);
      expect(getButton()).toHaveAttribute("type", "submit");
    });

    it("merges custom className with generated classes", () => {
      render(<Button className="my-class">Click</Button>);
      expect(getButton()).toHaveClass("nxm-button", "my-class");
    });
  });
});

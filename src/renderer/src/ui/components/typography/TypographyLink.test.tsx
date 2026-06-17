import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { TypographyLink } from "./TypographyLink";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const getLink = (name: string | RegExp = /link/i) => screen.getByRole("button", { name });

// --- Tests ---

describe("TypographyLink", () => {
  describe("rendering", () => {
    it("renders a button with the base class", () => {
      render(<TypographyLink>link</TypographyLink>);
      expect(getLink()).toHaveClass("nxm-link");
    });

    it("renders children", () => {
      render(<TypographyLink>Open page</TypographyLink>);
      expect(screen.getByText("Open page")).toBeInTheDocument();
    });

    it("renders customContent when provided", () => {
      render(<TypographyLink customContent={<span data-testid="custom">x</span>} />);
      expect(screen.getByTestId("custom")).toBeInTheDocument();
    });

    it("renders left and right icons from paths", () => {
      render(
        <TypographyLink leftIconPath="mdi-left" rightIconPath="mdi-right">
          link
        </TypographyLink>,
      );
      expect(screen.getAllByRole("presentation")).toHaveLength(2);
    });
  });

  describe("variant", () => {
    it.each([
      ["primary", "nxm-link-variant-primary"],
      ["secondary", "nxm-link-variant-secondary"],
    ] as const)('applies the class for variant="%s"', (variant, cls) => {
      render(<TypographyLink variant={variant}>link</TypographyLink>);
      expect(getLink()).toHaveClass(cls);
    });

    it('applies no variant class for variant="none"', () => {
      render(<TypographyLink variant="none">link</TypographyLink>);
      expect(getLink()).not.toHaveClass("nxm-link-variant-primary", "nxm-link-variant-secondary");
    });

    it("defaults to the primary variant", () => {
      render(<TypographyLink>link</TypographyLink>);
      expect(getLink()).toHaveClass("nxm-link-variant-primary");
    });
  });

  describe("colour: brand + appearance", () => {
    it("defaults to neutral/strong with a hover step toward moderate", () => {
      render(<TypographyLink>link</TypographyLink>);
      expect(getLink()).toHaveClass("text-neutral-strong", "hover:text-neutral-moderate");
    });

    it("composes brand + appearance and steps appearance up on hover", () => {
      render(
        <TypographyLink appearance="moderate" brand="info">
          link
        </TypographyLink>,
      );
      // moderate -> strong on hover
      expect(getLink()).toHaveClass("text-info-moderate", "hover:text-info-strong");
    });

    it("uses the translucent ramp for neutral-translucent", () => {
      render(<TypographyLink brand="neutral-translucent">link</TypographyLink>);
      expect(getLink()).toHaveClass("text-translucent-strong", "hover:text-translucent-moderate");
    });

    it('applies no colour or hover class for brand="none"', () => {
      render(<TypographyLink brand="none">link</TypographyLink>);
      const el = getLink();
      // the type/size class (text-body-md) stays; only the colour utilities are dropped
      expect(el.className).not.toMatch(
        /text-(neutral|primary|info|success|premium|danger|warning|translucent)-/,
      );
      expect(el.className).not.toMatch(/hover:/);
    });
  });

  describe("typographyType", () => {
    it("applies the type class by default", () => {
      render(<TypographyLink>link</TypographyLink>);
      expect(getLink()).toHaveClass("text-body-md");
    });

    it('applies no type class when typographyType="inherit"', () => {
      render(<TypographyLink typographyType="inherit">link</TypographyLink>);
      expect(getLink()).not.toHaveClass("text-body-md");
    });
  });

  describe("disabled state", () => {
    it("disables the button and marks it disabled", () => {
      render(<TypographyLink disabled>link</TypographyLink>);
      const el = getLink();
      expect(el).toBeDisabled();
      expect(el).toHaveClass("nxm-link-disabled");
    });

    it("omits the hover colour class when disabled", () => {
      render(<TypographyLink disabled>link</TypographyLink>);
      expect(getLink().className).not.toMatch(/hover:/);
    });

    it("marks aria-disabled but keeps it focusable (not the disabled attribute)", () => {
      render(<TypographyLink aria-disabled={true}>link</TypographyLink>);
      const el = getLink();
      expect(el).toHaveClass("nxm-link-disabled");
      expect(el).not.toBeDisabled();
      expect(el.className).not.toMatch(/hover:/);
    });
  });

  describe("interactions", () => {
    it("calls onClick when clicked", async () => {
      const onClick = vi.fn();
      render(<TypographyLink onClick={onClick}>link</TypographyLink>);
      await userEvent.click(getLink());
      expect(onClick).toHaveBeenCalledOnce();
    });

    it("does not call onClick when disabled", async () => {
      const onClick = vi.fn();
      render(
        <TypographyLink disabled onClick={onClick}>
          link
        </TypographyLink>,
      );
      await userEvent.click(getLink());
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("pass-through", () => {
    it("merges a custom className", () => {
      render(<TypographyLink className="my-class">link</TypographyLink>);
      expect(getLink()).toHaveClass("nxm-link", "my-class");
    });

    it("forwards arbitrary HTML attributes", () => {
      render(<TypographyLink data-testid="lk">link</TypographyLink>);
      expect(screen.getByTestId("lk")).toBeInTheDocument();
    });
  });
});

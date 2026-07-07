import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";

import { Typography } from "./Typography";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const get = (text = "text") => screen.getByText(text);

// --- Tests ---

describe("Typography", () => {
  describe("element + type", () => {
    it("renders a <p> with the body-md type class by default", () => {
      render(<Typography>text</Typography>);
      const el = get();
      expect(el.tagName).toBe("P");
      expect(el).toHaveClass("text-body-md");
    });

    it("renders the element given by `as`", () => {
      render(<Typography as="h1">text</Typography>);
      expect(get().tagName).toBe("H1");
    });

    it("infers the type class from `as` when typographyType is omitted", () => {
      render(<Typography as="h1">text</Typography>);
      expect(get()).toHaveClass("text-heading-2xl");
    });

    it("uses an explicit typographyType over the inferred one", () => {
      render(
        <Typography as="h1" typographyType="body-sm">
          text
        </Typography>,
      );
      expect(get()).toHaveClass("text-body-sm");
      expect(get()).not.toHaveClass("text-heading-2xl");
    });
  });

  describe("colour: brand + appearance", () => {
    it("defaults to neutral/strong", () => {
      render(<Typography>text</Typography>);
      expect(get()).toHaveClass("text-neutral-strong");
    });

    it("applies the neutral ramp via appearance", () => {
      render(<Typography appearance="moderate">text</Typography>);
      expect(get()).toHaveClass("text-neutral-moderate");
    });

    it.each([
      ["primary", "strong", "text-primary-strong"],
      ["info", "moderate", "text-info-moderate"],
      ["success", "subdued", "text-success-subdued"],
      ["premium", "weak", "text-premium-weak"],
    ] as const)('composes brand="%s" + appearance="%s"', (brand, appearance, cls) => {
      render(
        <Typography brand={brand} appearance={appearance}>
          text
        </Typography>,
      );
      expect(get()).toHaveClass(cls);
    });

    it("defaults appearance to strong for a non-neutral brand", () => {
      render(<Typography brand="info">text</Typography>);
      expect(get()).toHaveClass("text-info-strong");
    });

    it("renders the neutral inverted colour", () => {
      render(<Typography appearance="inverted">text</Typography>);
      expect(get()).toHaveClass("text-neutral-inverted");
    });
  });

  describe('brand="none"', () => {
    it("applies no colour class so the element inherits its colour", () => {
      render(<Typography brand="none">text</Typography>);
      const el = get();
      // still has its type class, but no text-{brand}-{appearance} colour class
      expect(el).toHaveClass("text-body-md");
      expect(el.className).not.toMatch(/text-(neutral|primary|info|success|premium)-/);
    });

    it("preserves a caller-provided colour className", () => {
      render(
        <Typography brand="none" className="text-danger-strong">
          text
        </Typography>,
      );
      expect(get()).toHaveClass("text-danger-strong");
    });
  });

  describe("neutral-translucent brand", () => {
    it("uses the shared translucent ramp", () => {
      render(
        <Typography appearance="moderate" brand="neutral-translucent">
          text
        </Typography>,
      );
      expect(get()).toHaveClass("text-translucent-moderate");
    });

    it("defaults to the strong translucent colour", () => {
      render(<Typography brand="neutral-translucent">text</Typography>);
      expect(get()).toHaveClass("text-translucent-strong");
    });

    it("uses the inverted translucent colour", () => {
      render(
        <Typography appearance="inverted" brand="neutral-translucent">
          text
        </Typography>,
      );
      expect(get()).toHaveClass("text-translucent-inverted");
    });
  });

  describe("pass-through", () => {
    it("merges a custom className", () => {
      render(<Typography className="my-class">text</Typography>);
      expect(get()).toHaveClass("text-neutral-strong", "my-class");
    });

    it("forwards arbitrary HTML attributes", () => {
      render(<Typography data-testid="tg">text</Typography>);
      expect(screen.getByTestId("tg")).toBeInTheDocument();
    });
  });
});

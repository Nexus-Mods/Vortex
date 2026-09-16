import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { Pill } from "./Pill";

// --- Helpers ---

type PillProps = React.ComponentProps<typeof Pill>;

const renderComponent = (props: Partial<PillProps> = {}) => {
  const onClick = vi.fn();

  render(<Pill {...({ children: "Label", onClick, ...props } as PillProps)} />);

  return { onClick };
};

const getPill = () => document.querySelector(".nxm-pill");

// --- Tests ---

describe("Pill", () => {
  describe("default (div) variant", () => {
    it("renders a div with the base and default brand/appearance classes", () => {
      renderComponent();
      const pill = getPill();
      expect(pill?.tagName).toBe("DIV");
      expect(pill).toHaveClass("nxm-pill", "nxm-pill-neutral", "nxm-pill-subdued");
    });

    it("renders the label text", () => {
      renderComponent();
      expect(screen.getByText("Label")).toHaveClass("nxm-pill-label");
    });

    it("merges a custom className", () => {
      renderComponent({ className: "my-class" });
      expect(getPill()).toHaveClass("nxm-pill", "my-class");
    });
  });

  describe("brand", () => {
    it.each([
      ["primary", "nxm-pill-primary"],
      ["info", "nxm-pill-info"],
      ["neutral", "nxm-pill-neutral"],
      ["light", "nxm-pill-light"],
      ["success", "nxm-pill-success"],
      ["danger", "nxm-pill-danger"],
      ["warning", "nxm-pill-warning"],
      ["premium", "nxm-pill-premium"],
    ] as const)('applies correct class for brand="%s"', (brand, cls) => {
      renderComponent({ brand });
      expect(getPill()).toHaveClass(cls);
    });
  });

  describe("appearance", () => {
    it.each([
      ["subdued", "nxm-pill-subdued"],
      ["scrim", "nxm-pill-scrim"],
    ] as const)('applies correct class for appearance="%s"', (appearance, cls) => {
      renderComponent({ appearance });
      expect(getPill()).toHaveClass(cls);
    });

    // `none` still emits its class; it just has no rule behind it, which is what opts
    // the pill out of the border and label colour.
    it('leaves the treatment off for appearance="none"', () => {
      renderComponent({ appearance: "none" });
      const pill = getPill();
      expect(pill).toHaveClass("nxm-pill");
      expect(pill).not.toHaveClass("nxm-pill-subdued");
    });
  });

  it("combines brand and appearance classes", () => {
    renderComponent({ appearance: "subdued", brand: "danger" });
    expect(getPill()).toHaveClass("nxm-pill", "nxm-pill-danger", "nxm-pill-subdued");
  });

  describe("icon", () => {
    it("renders an icon from iconPath", () => {
      renderComponent({ iconPath: "M0 0h24v24H0z" });
      expect(screen.getByRole("presentation")).toHaveClass("nxm-pill-icon");
    });

    it("renders a custom icon node", () => {
      renderComponent({ icon: <span data-testid="custom-icon" /> });
      expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    });
  });

  describe('button variant (as="button")', () => {
    it("renders a button with type=button", () => {
      renderComponent({ as: "button" });
      const button = screen.getByRole("button", { name: /label/i });
      expect(button).toHaveAttribute("type", "button");
      expect(button).toHaveClass("nxm-pill");
    });

    it("calls onClick when clicked", async () => {
      const { onClick } = renderComponent({ as: "button" });
      await userEvent.click(screen.getByRole("button", { name: /label/i }));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it("does not call onClick when disabled", async () => {
      const { onClick } = renderComponent({ as: "button", disabled: true });
      await userEvent.click(screen.getByRole("button", { name: /label/i }));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("pass-through", () => {
    it("forwards arbitrary HTML attributes to the div", () => {
      renderComponent({ id: "my-pill" });
      expect(document.querySelector("#my-pill")).toBeInTheDocument();
    });

    // Anything anchoring to a pill — a Tooltip, a popover — positions itself off this
    // node, and a plain function component would never have been handed the ref.
    it("hands a ref to the div it renders", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Pill ref={ref} id="my-pill">
          Label
        </Pill>,
      );

      expect(ref.current).toBe(document.querySelector("#my-pill"));
    });

    it("hands a ref to the button variant too", () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(
        <Pill as="button" ref={ref}>
          Label
        </Pill>,
      );

      expect(ref.current).toBe(screen.getByRole("button", { name: /label/i }));
    });
  });
});

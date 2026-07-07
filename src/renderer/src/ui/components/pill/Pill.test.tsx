import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Pill } from "./Pill";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

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
    it("renders a div with the base and default-type classes", () => {
      renderComponent();
      const pill = getPill();
      expect(pill?.tagName).toBe("DIV");
      expect(pill).toHaveClass("nxm-pill", "nxm-pill-default");
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

  describe("pillType", () => {
    it.each([
      ["default", "nxm-pill-default"],
      ["success", "nxm-pill-success"],
    ] as const)("applies the %s modifier class", (pillType, cls) => {
      renderComponent({ pillType });
      expect(getPill()).toHaveClass(cls);
    });

    it('applies no modifier class for pillType="none"', () => {
      renderComponent({ pillType: "none" });
      const pill = getPill();
      expect(pill).toHaveClass("nxm-pill");
      expect(pill?.className).not.toMatch(/nxm-pill-(default|success|none)/);
    });
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
  });
});

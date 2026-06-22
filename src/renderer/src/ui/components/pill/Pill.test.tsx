import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Pill } from "./Pill";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const getPill = () => document.querySelector(".nxm-pill");

// --- Tests ---

describe("Pill", () => {
  describe("default (div) variant", () => {
    it("renders a div with the base and default-type classes", () => {
      render(<Pill>Label</Pill>);
      const pill = getPill();
      expect(pill?.tagName).toBe("DIV");
      expect(pill).toHaveClass("nxm-pill", "nxm-pill-default");
    });

    it("renders the label text", () => {
      render(<Pill>Label</Pill>);
      expect(screen.getByText("Label")).toHaveClass("nxm-pill-label");
    });

    it("merges a custom className", () => {
      render(<Pill className="my-class">Label</Pill>);
      expect(getPill()).toHaveClass("nxm-pill", "my-class");
    });
  });

  describe("pillType", () => {
    it.each([
      ["default", "nxm-pill-default"],
      ["success", "nxm-pill-success"],
    ] as const)("applies the %s modifier class", (pillType, cls) => {
      render(<Pill pillType={pillType}>Label</Pill>);
      expect(getPill()).toHaveClass(cls);
    });

    it('applies no modifier class for pillType="none"', () => {
      render(<Pill pillType="none">Label</Pill>);
      const pill = getPill();
      expect(pill).toHaveClass("nxm-pill");
      expect(pill?.className).not.toMatch(/nxm-pill-(default|success|none)/);
    });
  });

  describe("icon", () => {
    it("renders an icon from iconPath", () => {
      render(<Pill iconPath="M0 0h24v24H0z">Label</Pill>);
      expect(screen.getByRole("presentation")).toHaveClass("nxm-pill-icon");
    });

    it("renders a custom icon node", () => {
      render(<Pill icon={<span data-testid="custom-icon" />}>Label</Pill>);
      expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    });
  });

  describe('button variant (as="button")', () => {
    it("renders a button with type=button", () => {
      render(<Pill as="button">Label</Pill>);
      const button = screen.getByRole("button", { name: /label/i });
      expect(button).toHaveAttribute("type", "button");
      expect(button).toHaveClass("nxm-pill");
    });

    it("calls onClick when clicked", async () => {
      const onClick = vi.fn();
      render(
        <Pill as="button" onClick={onClick}>
          Label
        </Pill>,
      );
      await userEvent.click(screen.getByRole("button", { name: /label/i }));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it("does not call onClick when disabled", async () => {
      const onClick = vi.fn();
      render(
        <Pill as="button" disabled={true} onClick={onClick}>
          Label
        </Pill>,
      );
      await userEvent.click(screen.getByRole("button", { name: /label/i }));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("pass-through", () => {
    it("forwards arbitrary HTML attributes to the div", () => {
      render(<Pill data-testid="my-pill">Label</Pill>);
      expect(screen.getByTestId("my-pill")).toBeInTheDocument();
    });
  });
});

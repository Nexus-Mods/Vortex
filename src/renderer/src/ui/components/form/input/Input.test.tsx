import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Input } from "./Input";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const renderComponent = (props: Partial<React.ComponentProps<typeof Input>> = {}) => {
  const onChange = vi.fn();

  render(<Input id="name" label="Name" onChange={onChange} {...props} />);

  return { onChange };
};

const getInput = () => screen.getByRole("textbox");

// --- Tests ---

describe("Input", () => {
  describe("rendering", () => {
    it("renders a text input with the base class", () => {
      renderComponent();
      expect(getInput()).toHaveClass("nxm-input");
    });

    it("renders its label via FormField", () => {
      renderComponent();
      expect(screen.getByText("Name")).toBeInTheDocument();
    });

    it("reflects a controlled value", () => {
      renderComponent({ value: "hello" });
      expect(getInput()).toHaveValue("hello");
    });
  });

  describe("interactions", () => {
    it("calls onChange when the user types", async () => {
      const { onChange } = renderComponent();
      await userEvent.type(getInput(), "a");
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("error state", () => {
    it("marks the input invalid and shows the message", () => {
      renderComponent({ errorMessage: "Too short" });
      const input = getInput();
      expect(input).toHaveClass("nxm-input-error");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAttribute("aria-describedby", "name_error");
      expect(screen.getByText("Too short")).toBeInTheDocument();
    });
  });

  describe("size", () => {
    it('applies the sm modifier for size="sm"', () => {
      renderComponent({ size: "sm" });
      expect(getInput()).toHaveClass("nxm-input-sm");
    });

    it("does not apply the sm modifier for the default size", () => {
      renderComponent();
      expect(getInput()).not.toHaveClass("nxm-input-sm");
    });
  });

  describe("disabled / readOnly", () => {
    it("disables the input and applies the disabled class", () => {
      renderComponent({ disabled: true });
      expect(getInput()).toBeDisabled();
      expect(getInput()).toHaveClass("nxm-input-disabled");
    });

    it("applies the disabled class when readOnly", () => {
      renderComponent({ readOnly: true });
      expect(getInput()).toHaveClass("nxm-input-disabled");
      expect(getInput()).toHaveAttribute("readonly");
    });
  });

  describe("required", () => {
    it("shows the required label when required", () => {
      renderComponent({ required: true });
      expect(screen.getByText(/\(Required\)/)).toBeInTheDocument();
    });
  });

  describe("character counter", () => {
    it("updates the remaining count as the user types", async () => {
      renderComponent({ id: "bio", label: "Bio", maxLength: 10 });
      expect(screen.getByLabelText("remaining character count")).toHaveTextContent("10 / 10");
      await userEvent.type(getInput(), "abc");
      expect(screen.getByLabelText("remaining character count")).toHaveTextContent("7 / 10");
    });
  });

  it("merges a custom className on the input", () => {
    renderComponent({ className: "my-class" });
    expect(getInput()).toHaveClass("nxm-input", "my-class");
  });
});

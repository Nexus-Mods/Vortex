import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Input } from "./Input";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const getInput = () => screen.getByRole("textbox");

// --- Tests ---

describe("Input", () => {
  describe("rendering", () => {
    it("renders a text input with the base class", () => {
      render(<Input id="name" label="Name" />);
      expect(getInput()).toHaveClass("nxm-input");
    });

    it("renders its label via FormField", () => {
      render(<Input id="name" label="Name" />);
      expect(screen.getByText("Name")).toBeInTheDocument();
    });

    it("reflects a controlled value", () => {
      render(<Input id="name" label="Name" value="hello" onChange={() => undefined} />);
      expect(getInput()).toHaveValue("hello");
    });
  });

  describe("interactions", () => {
    it("calls onChange when the user types", async () => {
      const onChange = vi.fn();
      render(<Input id="name" label="Name" onChange={onChange} />);
      await userEvent.type(getInput(), "a");
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("error state", () => {
    it("marks the input invalid and shows the message", () => {
      render(<Input errorMessage="Too short" id="name" label="Name" />);
      const input = getInput();
      expect(input).toHaveClass("nxm-input-error");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAttribute("aria-describedby", "name_error");
      expect(screen.getByText("Too short")).toBeInTheDocument();
    });
  });

  describe("size", () => {
    it('applies the sm modifier for size="sm"', () => {
      render(<Input id="name" label="Name" size="sm" />);
      expect(getInput()).toHaveClass("nxm-input-sm");
    });

    it("does not apply the sm modifier for the default size", () => {
      render(<Input id="name" label="Name" />);
      expect(getInput()).not.toHaveClass("nxm-input-sm");
    });
  });

  describe("disabled / readOnly", () => {
    it("disables the input and applies the disabled class", () => {
      render(<Input disabled={true} id="name" label="Name" />);
      expect(getInput()).toBeDisabled();
      expect(getInput()).toHaveClass("nxm-input-disabled");
    });

    it("applies the disabled class when readOnly", () => {
      render(<Input id="name" label="Name" readOnly={true} />);
      expect(getInput()).toHaveClass("nxm-input-disabled");
      expect(getInput()).toHaveAttribute("readonly");
    });
  });

  describe("required", () => {
    it("shows the required label when required", () => {
      render(<Input id="name" label="Name" required={true} />);
      expect(screen.getByText(/\(Required\)/)).toBeInTheDocument();
    });
  });

  describe("character counter", () => {
    it("updates the remaining count as the user types", async () => {
      render(<Input id="bio" label="Bio" maxLength={10} />);
      expect(screen.getByLabelText("remaining character count")).toHaveTextContent("10 / 10");
      await userEvent.type(getInput(), "abc");
      expect(screen.getByLabelText("remaining character count")).toHaveTextContent("7 / 10");
    });
  });

  it("merges a custom className on the input", () => {
    render(<Input className="my-class" id="name" label="Name" />);
    expect(getInput()).toHaveClass("nxm-input", "my-class");
  });
});

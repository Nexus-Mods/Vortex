import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Select } from "./Select";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const options = (
  <>
    <option value="a">Apple</option>
    <option value="b">Banana</option>
  </>
);

const renderComponent = (props: Partial<React.ComponentProps<typeof Select>> = {}) => {
  const onChange = vi.fn();

  render(
    <Select id="fruit" label="Fruit" onChange={onChange} {...props}>
      {options}
    </Select>,
  );

  return { onChange };
};

const getSelect = () => screen.getByRole("combobox");

// --- Tests ---

describe("Select", () => {
  describe("rendering", () => {
    it("renders a select with the given options", () => {
      renderComponent();
      expect(getSelect()).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Apple" })).toBeInTheDocument();
    });

    it("renders its label via FormField", () => {
      renderComponent();
      expect(screen.getByText("Fruit")).toBeInTheDocument();
    });

    it("renders the dropdown chevron icon", () => {
      renderComponent();
      expect(screen.getByRole("presentation")).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("reflects a controlled value", () => {
      renderComponent({ value: "b" });
      expect(getSelect()).toHaveValue("b");
    });

    it("calls onChange when a new option is selected", async () => {
      const { onChange } = renderComponent();
      await userEvent.selectOptions(getSelect(), "b");
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("error state", () => {
    it("marks the select invalid and shows the message", () => {
      renderComponent({ errorMessage: "Pick one" });
      expect(getSelect()).toHaveAttribute("aria-invalid", "true");
      expect(getSelect()).toHaveAttribute("aria-describedby", "fruit_error");
      expect(screen.getByText("Pick one")).toBeInTheDocument();
    });
  });

  describe("disabled / required", () => {
    it("disables the select", () => {
      renderComponent({ disabled: true });
      expect(getSelect()).toBeDisabled();
    });

    it("shows the required label when required", () => {
      renderComponent({ required: true });
      expect(screen.getByText(/\(Required\)/)).toBeInTheDocument();
    });
  });
});

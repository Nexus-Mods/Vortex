import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Checkbox } from "./Checkbox";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const renderComponent = (props: Partial<React.ComponentProps<typeof Checkbox>> = {}) => {
  const onChange = vi.fn();

  render(<Checkbox onChange={onChange} {...props} />);

  return { onChange };
};

const getCheckbox = () => screen.getByRole("checkbox");
const getField = () => document.querySelector(".nxm-checkbox-field");

// --- Tests ---

describe("Checkbox", () => {
  it("renders an unchecked checkbox by default", () => {
    renderComponent();
    expect(getCheckbox()).not.toBeChecked();
  });

  it("reflects the checked prop", () => {
    renderComponent({ checked: true });
    expect(getCheckbox()).toBeChecked();
  });

  it("renders label children", () => {
    renderComponent({ children: "Accept terms" });
    expect(screen.getByText("Accept terms")).toHaveClass("nxm-checkbox-label");
  });

  describe("state classes", () => {
    it("adds the checked class when checked", () => {
      renderComponent({ checked: true });
      expect(getField()).toHaveClass("nxm-checkbox-checked");
    });

    it("adds the disabled class and attribute when disabled", () => {
      renderComponent({ disabled: true });
      expect(getField()).toHaveClass("nxm-checkbox-disabled");
      expect(getCheckbox()).toBeDisabled();
    });

    it("adds the error class when hasError", () => {
      renderComponent({ hasError: true });
      expect(getField()).toHaveClass("nxm-checkbox-error");
    });
  });

  describe("interactions", () => {
    it("calls onChange when clicked", async () => {
      const { onChange } = renderComponent({ checked: false });
      await userEvent.click(getCheckbox());
      expect(onChange).toHaveBeenCalledOnce();
    });

    it("does not call onChange when disabled", async () => {
      const { onChange } = renderComponent({ checked: false, disabled: true });
      await userEvent.click(getCheckbox());
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it("merges a custom className onto the field", () => {
    renderComponent({ className: "my-class" });
    expect(getField()).toHaveClass("nxm-checkbox-field", "my-class");
  });

  it("forwards arbitrary input attributes", () => {
    renderComponent({ name: "terms", value: "yes" });
    expect(getCheckbox()).toHaveAttribute("name", "terms");
  });
});

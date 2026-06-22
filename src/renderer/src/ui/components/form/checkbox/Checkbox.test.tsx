import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Checkbox } from "./Checkbox";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const getCheckbox = () => screen.getByRole("checkbox");
const getField = () => document.querySelector(".nxm-checkbox-field");

// --- Tests ---

describe("Checkbox", () => {
  it("renders an unchecked checkbox by default", () => {
    render(<Checkbox />);
    expect(getCheckbox()).not.toBeChecked();
  });

  it("reflects the checked prop", () => {
    render(<Checkbox checked={true} onChange={() => undefined} />);
    expect(getCheckbox()).toBeChecked();
  });

  it("renders label children", () => {
    render(<Checkbox>Accept terms</Checkbox>);
    expect(screen.getByText("Accept terms")).toHaveClass("nxm-checkbox-label");
  });

  describe("state classes", () => {
    it("adds the checked class when checked", () => {
      render(<Checkbox checked={true} onChange={() => undefined} />);
      expect(getField()).toHaveClass("nxm-checkbox-checked");
    });

    it("adds the disabled class and attribute when disabled", () => {
      render(<Checkbox disabled={true} />);
      expect(getField()).toHaveClass("nxm-checkbox-disabled");
      expect(getCheckbox()).toBeDisabled();
    });

    it("adds the error class when hasError", () => {
      render(<Checkbox hasError={true} />);
      expect(getField()).toHaveClass("nxm-checkbox-error");
    });
  });

  describe("interactions", () => {
    it("calls onChange when clicked", async () => {
      const onChange = vi.fn();
      render(<Checkbox checked={false} onChange={onChange} />);
      await userEvent.click(getCheckbox());
      expect(onChange).toHaveBeenCalledOnce();
    });

    it("does not call onChange when disabled", async () => {
      const onChange = vi.fn();
      render(<Checkbox checked={false} disabled={true} onChange={onChange} />);
      await userEvent.click(getCheckbox());
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it("merges a custom className onto the field", () => {
    render(<Checkbox className="my-class" />);
    expect(getField()).toHaveClass("nxm-checkbox-field", "my-class");
  });

  it("forwards arbitrary input attributes", () => {
    render(<Checkbox name="terms" value="yes" />);
    expect(getCheckbox()).toHaveAttribute("name", "terms");
  });
});

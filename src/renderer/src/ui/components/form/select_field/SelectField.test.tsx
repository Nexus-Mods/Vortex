import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { SelectField, type ISelectFieldProps } from "./SelectField";

const renderField = (props: Partial<ISelectFieldProps> = {}) =>
  render(
    <SelectField label="Fruit" {...props}>
      <option value="a">Apple</option>
      <option value="b">Banana</option>
    </SelectField>,
  );

const getSelect = () => screen.getByRole("combobox", { name: /Fruit/ });

/** The text of every element the select's aria-describedby points at, in order. */
const descriptions = () =>
  (getSelect().getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);

describe("SelectField", () => {
  describe("label", () => {
    it("names the select, and focuses it when clicked", async () => {
      renderField();

      await userEvent.click(screen.getByText("Fruit"));

      expect(getSelect()).toHaveFocus();
    });

    it("still names the select when hidden", () => {
      renderField({ hideLabel: true });
      expect(screen.getByText("Fruit")).toHaveClass("sr-only");
      expect(getSelect()).toBeInTheDocument();
    });

    it("shows (Required) for a required select", () => {
      renderField({ required: true });
      expect(screen.getByRole("combobox", { name: "Fruit (Required)" })).toBeRequired();
    });

    it("lets showRequiredLabel override required", () => {
      renderField({ required: true, showRequiredLabel: false });
      expect(screen.getByRole("combobox", { name: "Fruit" })).toBeRequired();
    });
  });

  describe("hints and errors", () => {
    it("describes the select with its hints", () => {
      renderField({ hints: ["First", "Second"] });
      expect(descriptions()).toEqual(["First", "Second"]);
    });

    it("marks the select invalid and describes it with the error first", () => {
      renderField({ errorMessage: "Pick one", hints: "A hint" });
      expect(getSelect()).toHaveAttribute("aria-invalid", "true");
      expect(descriptions()).toEqual(["Pick one", "A hint"]);
    });

    it("hides the error on screen but not from screen readers with hideErrors", () => {
      renderField({ errorMessage: "Pick one", hideErrors: true });
      expect(screen.getByText("Pick one")).toHaveClass("sr-only");
      expect(descriptions()).toEqual(["Pick one"]);
    });
  });

  it("disables the select and marks the label disabled", () => {
    renderField({ disabled: true });
    expect(getSelect()).toBeDisabled();
    expect(screen.getByText("Fruit")).toHaveAttribute("data-disabled");
  });

  it("passes the change event through", async () => {
    const onChange = vi.fn();
    renderField({ onChange });

    await userEvent.selectOptions(getSelect(), "b");

    expect(onChange.mock.calls[0][0].target.value).toBe("b");
  });

  it("puts className on the select and fieldClassName on the field", () => {
    renderField({ className: "select-class", fieldClassName: "field-class" });
    expect(getSelect()).toHaveClass("nxm-select", "select-class");
    expect(getSelect().closest(".nxm-field")).toHaveClass("field-class");
  });
});

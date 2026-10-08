import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { CheckboxField, type ICheckboxFieldProps } from "./CheckboxField";

const renderField = (props: Partial<ICheckboxFieldProps> = {}) =>
  render(<CheckboxField label="Accept terms" {...props} />);

const getCheckbox = () => screen.getByRole("checkbox", { name: /Accept terms/ });

/** The text of every element the checkbox's aria-describedby points at, in order. */
const descriptions = () =>
  (getCheckbox().getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);

describe("CheckboxField", () => {
  it("names the checkbox, and toggles it when the label is clicked", async () => {
    const onChange = vi.fn();
    renderField({ checked: false, onChange });

    await userEvent.click(screen.getByText("Accept terms"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("takes rich content as its label", () => {
    render(
      <CheckboxField
        label={
          <span>
            <strong>SkyUI</strong> needs SKSE
          </span>
        }
      />,
    );
    expect(screen.getByRole("checkbox", { name: "SkyUI needs SKSE" })).toBeInTheDocument();
  });

  it("still names the checkbox when the label is hidden", () => {
    renderField({ hideLabel: true });
    expect(screen.getByText("Accept terms")).toHaveClass("sr-only");
    expect(getCheckbox()).toBeInTheDocument();
  });

  it("marks the checkbox invalid and describes it with the error, then the hints", () => {
    renderField({ errorMessage: "Required to continue", hints: "Read them first" });
    expect(getCheckbox()).toHaveAttribute("aria-invalid", "true");
    expect(descriptions()).toEqual(["Required to continue", "Read them first"]);
  });

  it("disables the checkbox and its label, and ignores clicks on either", async () => {
    const onChange = vi.fn();
    renderField({ disabled: true, onChange });

    await userEvent.click(screen.getByText("Accept terms"));
    await userEvent.click(getCheckbox());

    expect(screen.getByText("Accept terms")).toHaveAttribute("data-disabled");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("puts className on the checkbox and fieldClassName on the field", () => {
    renderField({ className: "box-class", fieldClassName: "field-class" });
    expect(getCheckbox()).toHaveClass("nxm-checkbox", "box-class");
    expect(getCheckbox().closest(".nxm-field")).toHaveClass("nxm-checkbox-field", "field-class");
  });
});

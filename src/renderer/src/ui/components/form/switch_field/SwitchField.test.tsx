import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { createRef } from "react";
import { describe, it, expect, vi } from "vitest";

import { SwitchField, type ISwitchFieldProps } from "./SwitchField";

const renderField = (props: Partial<ISwitchFieldProps> = {}) =>
  render(<SwitchField label="Auto-update" {...props} />);

const getSwitch = () => screen.getByRole("checkbox", { name: "Auto-update" });

/** The text of every element the switch's aria-describedby points at, in order. */
const descriptions = () =>
  (getSwitch().getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);

describe("SwitchField", () => {
  it("names the switch, and toggles it when the label is clicked", async () => {
    const onChange = vi.fn();
    renderField({ checked: false, onChange });

    await userEvent.click(screen.getByText("Auto-update"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("still names the switch when the label is hidden", () => {
    renderField({ hideLabel: true });
    expect(screen.getByText("Auto-update")).toHaveClass("sr-only");
    expect(getSwitch()).toBeInTheDocument();
  });

  it("describes the switch with its hints", () => {
    renderField({ hints: ["First", "Second"] });
    expect(descriptions()).toEqual(["First", "Second"]);
  });

  it("keeps semi-on", () => {
    renderField({ indeterminate: true, onChange: () => undefined });
    expect(getSwitch()).toBePartiallyChecked();
  });

  it("disables the switch and its label, and ignores clicks on either", async () => {
    const onChange = vi.fn();
    renderField({ disabled: true, onChange });

    await userEvent.click(screen.getByText("Auto-update"));
    await userEvent.click(getSwitch());

    expect(getSwitch()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Auto-update")).toHaveAttribute("data-disabled");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("puts className on the switch and fieldClassName on the field", () => {
    renderField({ className: "switch-class", fieldClassName: "field-class" });
    expect(getSwitch()).toHaveClass("nxm-switch", "switch-class");
    expect(getSwitch().closest(".nxm-field")).toHaveClass("nxm-switch-field", "field-class");
  });

  it("forwards its ref to the switch", () => {
    const ref = createRef<HTMLSpanElement>();
    renderField({ ref });
    expect(ref.current).toBe(getSwitch());
  });
});

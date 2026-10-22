import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { RadioGroupField, type IRadioGroupFieldProps } from "./RadioGroupField";

const options: IRadioGroupFieldProps["options"] = [
  { value: "replace", label: "Replace", hint: "Updates every profile", testId: "radio-replace" },
  { value: "alongside", label: "Install alongside", testId: "radio-alongside" },
  { value: "locked", label: "Locked", disabled: true, testId: "radio-locked" },
];

const renderGroup = (props: Partial<IRadioGroupFieldProps> = {}) => {
  const onChange = vi.fn();

  render(
    <RadioGroupField
      label="Update mode"
      options={options}
      value={undefined}
      onChange={onChange}
      {...props}
    />,
  );

  return { onChange };
};

describe("RadioGroupField", () => {
  it("is a radio group named by its label, with one radio per option", () => {
    renderGroup();

    expect(screen.getByRole("radiogroup", { name: "Update mode" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("checks the option whose value is selected and no other", () => {
    renderGroup({ value: "alongside" });

    expect(screen.getByTestId("radio-alongside")).toBeChecked();
    expect(screen.getByTestId("radio-replace")).not.toBeChecked();
  });

  it("checks nothing while no value is selected", () => {
    renderGroup();

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("reports the value of the option that is clicked", async () => {
    const { onChange } = renderGroup();

    await userEvent.click(screen.getByTestId("radio-alongside"));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("alongside");
  });

  it("chooses an option when its label is clicked", async () => {
    const { onChange } = renderGroup();

    const labelId = screen.getByTestId("radio-replace").getAttribute("aria-labelledby");

    await userEvent.click(document.getElementById(labelId ?? "") as HTMLElement);

    expect(onChange).toHaveBeenCalledExactlyOnceWith("replace");
  });

  it("reads a hint out as the option's description", () => {
    renderGroup();

    const described = screen.getByTestId("radio-replace").getAttribute("aria-describedby");

    expect(document.getElementById(described ?? "")).toHaveTextContent("Updates every profile");
  });

  it("does not choose a disabled option", async () => {
    const { onChange } = renderGroup();

    await userEvent.click(screen.getByTestId("radio-locked"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves the choice with the arrow keys", async () => {
    const { onChange } = renderGroup({ value: "replace" });

    screen.getByTestId("radio-replace").focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(onChange).toHaveBeenCalledWith("alongside");
  });
});

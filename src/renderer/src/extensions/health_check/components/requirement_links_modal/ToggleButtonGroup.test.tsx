import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { type IToggleButtonGroupProps, ToggleButtonGroup } from "./ToggleButtonGroup";

type Choice = "requires" | "recommends" | "skip";

const options: IToggleButtonGroupProps<Choice>["options"] = [
  { value: "requires", label: "Required", testId: "toggle-requires" },
  { value: "recommends", label: "Optional", testId: "toggle-recommends" },
  { value: "skip", label: "Skip", disabled: true, testId: "toggle-skip" },
];

const renderGroup = (props: Partial<IToggleButtonGroupProps<Choice>> = {}) => {
  const onChange = vi.fn();

  render(
    <ToggleButtonGroup
      label="Link type"
      options={options}
      value={undefined}
      onChange={onChange}
      {...props}
    />,
  );

  return { onChange };
};

describe("ToggleButtonGroup", () => {
  it("is a radio group named by its label, with a button per option", () => {
    renderGroup();

    expect(screen.getByRole("radiogroup", { name: "Link type" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
      "Required",
      "Optional",
      "Skip",
    ]);
  });

  it("fills the chosen option's button and checks no other", () => {
    renderGroup({ value: "recommends" });

    expect(screen.getByTestId("toggle-recommends")).toBeChecked();
    expect(screen.getByTestId("toggle-recommends")).toHaveClass("nxm-button-moderate");
    expect(screen.getByTestId("toggle-requires")).not.toBeChecked();
    expect(screen.getByTestId("toggle-requires")).toHaveClass("nxm-button-weak");
  });

  it("reports the value of the option that is clicked", async () => {
    const { onChange } = renderGroup({ value: "requires" });

    await userEvent.click(screen.getByTestId("toggle-recommends"));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("recommends");
  });

  it("does not choose a disabled option, and shows it as disabled", async () => {
    const { onChange } = renderGroup();

    await userEvent.click(screen.getByTestId("toggle-skip"));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("toggle-skip")).toHaveClass("nxm-button-disabled");
  });

  it("does not choose anything while the whole group is disabled", async () => {
    const { onChange } = renderGroup({ disabled: true });

    await userEvent.click(screen.getByTestId("toggle-recommends"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves the choice with the arrow keys", async () => {
    const { onChange } = renderGroup({ value: "requires" });

    screen.getByTestId("toggle-requires").focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("recommends");
  });
});

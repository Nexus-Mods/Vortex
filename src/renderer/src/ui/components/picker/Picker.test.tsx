import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { type IListboxOption } from "@/ui/components/listbox/ListboxOption";

import { Picker } from "./Picker";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const defaultOptions: IListboxOption<string>[] = [
  { label: "Red", value: "red" },
  { label: "Blue", value: "blue" },
];

const ControlledPicker = ({
  initialValue,
  onChange,
  options,
}: {
  initialValue: string;
  onChange: (value: string) => void;
  options: IListboxOption<string>[];
}) => {
  const [value, setValue] = useState(initialValue);

  return (
    <Picker
      options={options}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
};

const renderComponent = (options = defaultOptions, initialValue = "red") => {
  const onChange = vi.fn();

  render(<ControlledPicker initialValue={initialValue} options={options} onChange={onChange} />);

  return { onChange };
};

const getTrigger = () => screen.getByRole("button");

// --- Tests ---

describe("Picker", () => {
  it("shows the selected option's label in the trigger", () => {
    renderComponent();
    expect(getTrigger()).toHaveTextContent("Red");
  });

  it("does not show the options until opened", () => {
    renderComponent();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("reveals all options when opened", async () => {
    renderComponent();
    await userEvent.click(getTrigger());
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("calls onChange with the chosen value and updates the trigger", async () => {
    const { onChange } = renderComponent();

    await userEvent.click(getTrigger());
    await userEvent.click(screen.getByRole("option", { name: /blue/i }));

    expect(onChange).toHaveBeenCalledWith("blue");
    expect(getTrigger()).toHaveTextContent("Blue");
  });

  it("renders an option icon when iconPath is provided", async () => {
    renderComponent([{ iconPath: "M0 0h24v24H0z", label: "With icon", value: "x" }], "x");
    await userEvent.click(getTrigger());
    expect(
      screen.getByRole("option", { name: /with icon/i }).querySelector(".nxm-dropdown-item-icon"),
    ).toBeInTheDocument();
  });
});

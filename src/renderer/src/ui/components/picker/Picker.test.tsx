import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { type IListboxOption } from "../listbox/ListboxOption";
import { Picker } from "./Picker";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const options: IListboxOption<string>[] = [
  { label: "Red", value: "red" },
  { label: "Blue", value: "blue" },
];

const Harness = ({ onChange = vi.fn() }: { onChange?: (value: string) => void }) => {
  const [value, setValue] = useState("red");

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

const getTrigger = () => screen.getByRole("button");

// --- Tests ---

describe("Picker", () => {
  it("shows the selected option's label in the trigger", () => {
    render(<Harness />);
    expect(getTrigger()).toHaveTextContent("Red");
  });

  it("does not show the options until opened", () => {
    render(<Harness />);
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("reveals all options when opened", async () => {
    render(<Harness />);
    await userEvent.click(getTrigger());
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("calls onChange with the chosen value and updates the trigger", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(getTrigger());
    await userEvent.click(screen.getByRole("option", { name: /blue/i }));

    expect(onChange).toHaveBeenCalledWith("blue");
    expect(getTrigger()).toHaveTextContent("Blue");
  });

  it("renders an option icon when iconPath is provided", async () => {
    const iconOptions: IListboxOption<string>[] = [
      { iconPath: "M0 0h24v24H0z", label: "With icon", value: "x" },
    ];
    render(<Picker options={iconOptions} value="x" onChange={() => undefined} />);
    await userEvent.click(getTrigger());
    expect(
      screen.getByRole("option", { name: /with icon/i }).querySelector(".nxm-dropdown-item-icon"),
    ).toBeInTheDocument();
  });
});

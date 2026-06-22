import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Listbox } from "./Listbox";
import { ListboxButton } from "./ListboxButton";
import { ListboxOption } from "./ListboxOption";
import { ListboxOptions } from "./ListboxOptions";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const Harness = ({
  onChange = vi.fn(),
  showChevron,
}: {
  onChange?: (value: string) => void;
  showChevron?: boolean;
}) => {
  const [value, setValue] = useState("a");

  return (
    <Listbox
      value={value}
      onChange={(next: string) => {
        setValue(next);
        onChange(next);
      }}
    >
      <ListboxButton showChevron={showChevron}>{value}</ListboxButton>

      <ListboxOptions>
        <ListboxOption label="Apple" value="a" />

        <ListboxOption label="Banana" value="b" />
      </ListboxOptions>
    </Listbox>
  );
};

const getTrigger = () => screen.getByRole("button");

// --- Tests ---

describe("Listbox", () => {
  it("applies the nxm-dropdown class to the wrapper", () => {
    render(<Harness />);
    expect(document.querySelector(".nxm-dropdown")).toBeInTheDocument();
  });

  it("renders the trigger with a chevron icon by default", () => {
    render(<Harness />);
    expect(getTrigger().querySelector(".nxm-dropdown-button-icon")).toBeInTheDocument();
  });

  it("hides the chevron when showChevron is false", () => {
    render(<Harness showChevron={false} />);
    expect(getTrigger().querySelector(".nxm-dropdown-button-icon")).not.toBeInTheDocument();
  });

  it("does not show options until opened", () => {
    render(<Harness />);
    expect(screen.queryByText("Banana")).not.toBeInTheDocument();
  });

  it("reveals the options when the trigger is clicked", async () => {
    render(<Harness />);
    await userEvent.click(getTrigger());
    expect(screen.getByRole("option", { name: /apple/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /banana/i })).toBeInTheDocument();
  });

  it("calls onChange with the selected value", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(getTrigger());
    await userEvent.click(screen.getByRole("option", { name: /banana/i }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

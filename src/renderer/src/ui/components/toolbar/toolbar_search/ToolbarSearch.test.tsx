import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ToolbarSearch } from "./ToolbarSearch";

const Searchable = ({
  initial = "",
  onChange,
}: {
  initial?: string;
  onChange?: (value: string) => void;
}) => {
  const [value, setValue] = useState(initial);

  return (
    <>
      <ToolbarSearch
        label="Search"
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <button type="button">Elsewhere</button>
    </>
  );
};

const input = () => screen.queryByRole("textbox", { name: "Search" });
const button = () => screen.queryByRole("button", { name: "Search" });
const closeButton = () => screen.queryByRole("button", { name: "Close search" });

describe("ToolbarSearch", () => {
  it("slides out an input from its button, focused, the button becoming its close", async () => {
    render(<Searchable />);
    expect(input()).toBeNull();
    expect(button()).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(button()!);

    expect(input()).toHaveFocus();
    expect(closeButton()).toHaveAttribute("aria-expanded", "true");
  });

  it("passes on what's typed", async () => {
    const onChange = vi.fn();
    render(<Searchable onChange={onChange} />);

    await userEvent.click(button()!);
    await userEvent.keyboard("abc");

    expect(onChange).toHaveBeenLastCalledWith("abc");
    expect(input()).toHaveValue("abc");
  });

  it("clears with Escape, then closes, back on its button", async () => {
    render(<Searchable />);

    await userEvent.click(button()!);
    await userEvent.keyboard("abc{Escape}");
    expect(input()).toHaveValue("");

    await userEvent.keyboard("{Escape}");
    expect(input()).toBeNull();
    expect(button()).toHaveFocus();
  });

  it("closes once left empty, but stays open while it holds text", async () => {
    render(<Searchable />);

    await userEvent.click(button()!);
    await userEvent.keyboard("abc");
    await userEvent.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(input()).toHaveValue("abc");

    await userEvent.clear(input()!);
    await userEvent.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(input()).toBeNull();
  });

  it("clears and closes from its close button, which keeps the focus", async () => {
    const onChange = vi.fn();
    render(<Searchable initial="abc" onChange={onChange} />);

    await userEvent.click(closeButton()!);

    expect(onChange).toHaveBeenLastCalledWith("");
    expect(input()).toBeNull();
    expect(button()).toHaveFocus();
  });

  it("closes from its close button while empty", async () => {
    render(<Searchable />);

    await userEvent.click(button()!);
    await userEvent.click(closeButton()!);

    expect(input()).toBeNull();
  });
});

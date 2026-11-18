import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";
import { ModPropertySelect } from "./ModPropertySelect";

const category = (
  overrides: Partial<Extract<ModProperty, { kind: "select" }>> = {},
): Extract<ModProperty, { kind: "select" }> => ({
  kind: "select",
  id: "category",
  label: "Category",
  value: "1",
  isVarious: false,
  choices: [
    { value: "1", label: "Armour" },
    { value: "2", label: "Audio" },
  ],
  onChange: vi.fn(),
  ...overrides,
});

// The design system's dropdown: a button showing the pick, opening a list of options.
const trigger = () => screen.getByRole("button");
const open = () => userEvent.click(trigger());
// None first, where it's offered, then the choices in order.
const options = () => screen.getAllByRole("option");

describe("ModPropertySelect", () => {
  it("shows the pick and saves another", async () => {
    const onChange = vi.fn();
    render(<ModPropertySelect property={category({ onChange })} />);

    expect(trigger()).toHaveTextContent("Armour");
    await open();
    await userEvent.click(options()[2]);

    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("doesn't save the pick it already has again", async () => {
    const onChange = vi.fn();
    render(<ModPropertySelect property={category({ onChange })} />);

    await open();
    await userEvent.click(options()[1]);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("says Various where the mods differ, which isn't offered to pick back", async () => {
    render(<ModPropertySelect property={category({ value: "", isVarious: true })} />);

    expect(trigger()).toHaveTextContent("modsTable::properties::various");
    await open();
    expect(options()).toHaveLength(3);
  });

  it("names none as it's told to, where it means something of its own", () => {
    render(<ModPropertySelect property={category({ value: "", emptyLabel: "Default" })} />);

    expect(trigger()).toHaveTextContent("Default");
  });

  it("offers no none where a choice is required", async () => {
    render(<ModPropertySelect property={category({ required: true })} />);

    await open();
    expect(options()).toHaveLength(2);
  });

  it("can't be changed while it's disabled", () => {
    render(<ModPropertySelect property={category({ disabled: true })} />);

    expect(trigger()).toBeDisabled();
  });

  it("shows a saved value it doesn't offer as itself, not as another choice", () => {
    render(
      <ModPropertySelect property={category({ value: "skyrimspecialedition", required: true })} />,
    );

    expect(trigger()).toHaveTextContent("skyrimspecialedition");
  });

  it("says what it's told to where its value is none of the choices", () => {
    render(
      <ModPropertySelect
        property={category({ value: "", required: true, valueLabel: "Stardew Valley" })}
      />,
    );

    expect(trigger()).toHaveTextContent("Stardew Valley");
  });

  it("offers none, to clear it", async () => {
    const onChange = vi.fn();
    render(<ModPropertySelect property={category({ onChange })} />);

    await open();
    await userEvent.click(options()[0]);

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("is named by its label and described by its hint", () => {
    render(<ModPropertySelect property={category({ hint: "Pick one" })} />);

    expect(trigger()).toHaveAccessibleName(expect.stringContaining("Category"));
    expect(trigger()).toHaveAccessibleDescription("Pick one");
  });
});

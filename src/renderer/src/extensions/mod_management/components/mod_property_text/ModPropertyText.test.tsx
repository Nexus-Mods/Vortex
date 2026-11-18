import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";
import { ModPropertyText } from "./ModPropertyText";

const text = (
  overrides: Partial<Extract<ModProperty, { kind: "text" }>> = {},
): Extract<ModProperty, { kind: "text" }> => ({
  kind: "text",
  id: "registered:tag",
  label: "Tag",
  value: "",
  isVarious: false,
  onSave: vi.fn(),
  ...overrides,
});

describe("ModPropertyText", () => {
  it("saves on leaving the box", async () => {
    const onSave = vi.fn();
    render(<ModPropertyText property={text({ onSave })} />);

    await userEvent.type(screen.getByRole("textbox"), "Mine");
    fireEvent.blur(screen.getByRole("textbox"));

    expect(onSave).toHaveBeenCalledWith("Mine");
  });

  it("doesn't save text its check refuses, and says so", async () => {
    const onSave = vi.fn();
    render(<ModPropertyText property={text({ onSave, isValid: (input) => input !== "bad" })} />);

    await userEvent.type(screen.getByRole("textbox"), "bad");
    fireEvent.blur(screen.getByRole("textbox"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("doesn't save the text it already has again", async () => {
    const onSave = vi.fn();
    render(<ModPropertyText property={text({ onSave, value: "Kept" })} />);

    await userEvent.type(screen.getByRole("textbox"), "x{Backspace}");
    fireEvent.blur(screen.getByRole("textbox"));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("says Various where the mods differ", () => {
    render(<ModPropertyText property={text({ isVarious: true })} />);

    expect(screen.getByRole("textbox")).toHaveAttribute(
      "placeholder",
      "modsTable::properties::various",
    );
  });

  it("can't be changed where the extension says it's read-only", () => {
    render(<ModPropertyText property={text({ disabled: true })} />);

    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});

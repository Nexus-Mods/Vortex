import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";
import { ModPropertyNotes } from "./ModPropertyNotes";

const notes = (
  overrides: Partial<Extract<ModProperty, { kind: "notes" }>> = {},
): Extract<ModProperty, { kind: "notes" }> => ({
  kind: "notes",
  id: "notes",
  label: "Notes",
  value: "",
  isVarious: false,
  modIds: ["a"],
  onSave: vi.fn(),
  ...overrides,
});

describe("ModPropertyNotes", () => {
  it("saves on leaving the box, to the mods they were typed for", async () => {
    const onSave = vi.fn();
    render(<ModPropertyNotes property={notes({ onSave })} />);

    await userEvent.type(screen.getByRole("textbox"), "Load after SkyUI");
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByRole("textbox"));

    expect(onSave).toHaveBeenCalledWith(["a"], "Load after SkyUI");
  });

  it("saves nothing when nothing was typed", () => {
    const onSave = vi.fn();
    const { unmount } = render(<ModPropertyNotes property={notes({ onSave, value: "Kept" })} />);

    fireEvent.blur(screen.getByRole("textbox"));
    unmount();

    expect(onSave).not.toHaveBeenCalled();
  });

  it("says Various where the mods' notes differ", () => {
    render(<ModPropertyNotes property={notes({ isVarious: true, modIds: ["a", "b"] })} />);

    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "placeholder",
      "modsTable::properties::various",
    );
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";
import { ModPropertyField } from "./ModPropertyField";

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

const website = (onSave = vi.fn(), modId = "a", value = ""): ModProperty => ({
  kind: "url",
  id: "website",
  label: "Website",
  value,
  modId,
  onSave,
});

describe("ModPropertyField", () => {
  it("draws a value to read", () => {
    render(
      <ModPropertyField property={{ kind: "value", id: "version", label: "V", value: "1" }} />,
    );

    expect(screen.getByTestId("mod-property-version")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("draws a switch to change", () => {
    render(
      <ModPropertyField
        property={{ kind: "switch", id: "tweak", label: "T", checked: true, onChange: vi.fn() }}
      />,
    );

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  describe("notes", () => {
    it("saves what was typed for one mod as another is selected, to the first", async () => {
      const onSave = vi.fn();
      const { rerender } = render(<ModPropertyField property={notes({ onSave })} />);
      await userEvent.type(screen.getByRole("textbox"), "Mine");

      rerender(<ModPropertyField property={notes({ onSave, modIds: ["b"], value: "Theirs" })} />);

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith(["a"], "Mine");
      expect(screen.getByRole("textbox")).toHaveValue("Theirs");
    });

    it("shows notes changed elsewhere, while nothing's being typed", () => {
      const { rerender } = render(<ModPropertyField property={notes({ value: "Before" })} />);

      rerender(<ModPropertyField property={notes({ value: "After" })} />);

      expect(screen.getByRole("textbox")).toHaveValue("After");
    });
  });

  describe("a website's address", () => {
    it("saves a valid one typed for one mod as another's shows, to the first", async () => {
      const first = vi.fn();
      const { rerender } = render(<ModPropertyField property={website(first, "a")} />);
      await userEvent.type(screen.getByRole("textbox"), "https://example.com");

      rerender(<ModPropertyField property={website(vi.fn(), "b")} />);

      expect(first).toHaveBeenCalledWith("https://example.com");
      expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("drops one that isn't an address once another mod's shows", async () => {
      const first = vi.fn();
      const { rerender } = render(<ModPropertyField property={website(first, "a")} />);
      await userEvent.type(screen.getByRole("textbox"), "not an address");

      rerender(<ModPropertyField property={website(vi.fn(), "b")} />);

      expect(first).not.toHaveBeenCalled();
      expect(screen.getByRole("textbox")).toHaveValue("");
      expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid", "true");
    });
  });
});

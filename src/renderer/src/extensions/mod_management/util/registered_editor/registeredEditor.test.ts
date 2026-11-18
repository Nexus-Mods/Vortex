import { describe, expect, it, vi } from "vitest";

import type { ITableAttribute } from "@/types/ITableAttribute";

import type { IModWithState } from "../../types/IModProps";
import { registeredEditor } from "./registeredEditor";

const mod = (id: string): IModWithState =>
  ({ id, state: "installed", type: "", installationPath: id, attributes: {} }) as IModWithState;

const attribute = (edit: ITableAttribute["edit"], supportsMultiple = false): ITableAttribute => ({
  id: "load-order",
  name: "Load order",
  placement: "detail",
  calc: () => undefined,
  supportsMultiple,
  edit,
});

const CHOICES = [
  { key: "early", text: "Early" },
  { key: "late", text: "Late" },
  { key: "hidden", text: "Hidden", visible: false },
];

describe("registeredEditor", () => {
  it("is none for a field the extension offers no way to change", () => {
    expect(registeredEditor(attribute({}), [mod("a")], ["x"], "Load order", false)).toBeUndefined();
  });

  describe("with choices", () => {
    it("picks the choice whose text is the value, offering only visible ones", () => {
      const editor = registeredEditor(
        attribute({ choices: () => CHOICES, onChangeValue: vi.fn() }),
        [mod("a")],
        ["Late"],
        "Load order",
        false,
      );

      expect(editor).toMatchObject({
        kind: "select",
        value: "late",
        isVarious: false,
        choices: [
          { value: "early", label: "Early" },
          { value: "late", label: "Late" },
        ],
      });
    });

    it("sends a pick to the one mod, and none as cleared", () => {
      const onChangeValue = vi.fn();
      const a = mod("a");
      const editor = registeredEditor(
        attribute({ choices: () => CHOICES, onChangeValue }),
        [a],
        ["Late"],
        "Load order",
        false,
      );
      if (editor?.kind !== "select") {
        throw new Error("expected a select");
      }

      editor.onChange("early");
      editor.onChange("");

      expect(onChangeValue.mock.calls).toEqual([
        [a, "early"],
        [a, undefined],
      ]);
    });

    it("says various where the mods differ, sending a pick to them all", () => {
      const onChangeValue = vi.fn();
      const mods = [mod("a"), mod("b")];
      const editor = registeredEditor(
        attribute({ choices: () => CHOICES, onChangeValue }, true),
        mods,
        ["Early", "Late"],
        "Load order",
        true,
      );
      if (editor?.kind !== "select") {
        throw new Error("expected a select");
      }

      editor.onChange("late");

      expect(editor).toMatchObject({ value: "", isVarious: true });
      expect(onChangeValue).toHaveBeenCalledWith(mods, "late");
    });
  });

  describe("as text", () => {
    it("shows the value, valid by the extension's check", () => {
      const editor = registeredEditor(
        attribute({
          validate: (input) => (input.startsWith("v") ? "success" : "error"),
          onChangeValue: vi.fn(),
        }),
        [mod("a")],
        ["v1"],
        "Load order",
        false,
      );
      if (editor?.kind !== "text") {
        throw new Error("expected text");
      }

      expect(editor.value).toBe("v1");
      expect(editor.isValid?.("v2")).toBe(true);
      expect(editor.isValid?.("2")).toBe(false);
    });

    it("takes any text where the extension doesn't check it", () => {
      const editor = registeredEditor(
        attribute({ onChangeValue: vi.fn() }),
        [mod("a")],
        [3],
        "Load order",
        false,
      );

      expect(editor).toMatchObject({ kind: "text", value: "3", isValid: undefined });
    });

    it("is read-only where the extension says so for the mod", () => {
      const editor = registeredEditor(
        attribute({ readOnly: () => true, onChangeValue: vi.fn() }),
        [mod("a")],
        ["x"],
        "Load order",
        false,
      );

      expect(editor?.disabled).toBe(true);
    });
  });
});

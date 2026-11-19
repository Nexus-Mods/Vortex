import type { ITableAttribute } from "@/types/ITableAttribute";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";
import { valueText } from "../../hooks/use_registered_mods_columns/useRegisteredModsColumns.hook";
import type { IModWithState } from "../../types/IModProps";

/** An extension's field to type text in, saved on leaving the box. */
export interface IRegisteredText {
  kind: "text";
  /** Stable, unique among the properties. */
  id: string;
  label: string;
  /** Said under it, where there's more to say than its label. */
  hint?: string;
  /** The mods' text, "" while they differ. */
  value: string;
  /** Whether the selected mods differ. */
  isVarious: boolean;
  /** Whether typed text can be saved; any can where it doesn't say. */
  isValid?: (text: string) => boolean;
  /** Whether it can't be changed for these mods, though it shows. */
  disabled?: boolean;
  /** Saves typed text to every selected mod. */
  onSave: (text: string) => void;
}

/** What an extension's editable field is drawn as: a choice from a list, or text to type. */
export type RegisteredEditor = Extract<ModProperty, { kind: "select" }> | IRegisteredText;

/**
 * The editor an extension offers for its field, as the legacy details pane draws it: a choice from
 * its `choices`, else text checked by its `validate`, else plain text; none where it offers no
 * `onChangeValue`. Read-only where its `readOnly` says so for the first mod. A change goes to every
 * mod for a field that takes several, else to the one mod, as the legacy pane sends it.
 *
 * @param shown The field's values for the mods, in their order.
 * @param isVarious Whether those values differ.
 */
export const registeredEditor = (
  attribute: ITableAttribute,
  mods: IModWithState[],
  shown: unknown[],
  label: string,
  isVarious: boolean,
): RegisteredEditor | undefined => {
  const { edit } = attribute;
  const onChangeValue = edit?.onChangeValue;
  const [first] = mods;
  if (onChangeValue === undefined || first === undefined) {
    return undefined;
  }

  const change = (value: unknown) =>
    onChangeValue(attribute.supportsMultiple === true ? mods : first, value);
  const base = {
    id: `registered:${attribute.id}`,
    label,
    isVarious,
    disabled: edit.readOnly?.(first) === true,
  };

  if (edit.choices !== undefined) {
    const choices = edit.choices(first).filter(({ visible }) => visible !== false);
    // Picked by its text, as the legacy pane matches the value to a choice.
    const picked = isVarious ? undefined : choices.find(({ text }) => text === shown[0]);
    return {
      kind: "select",
      ...base,
      value: picked?.key ?? "",
      choices: choices.map(({ key, text }) => ({ value: key, label: text ?? key })),
      // None clears it, as the legacy pane's cleared select does.
      onChange: (value) => change(value === "" ? undefined : value),
    };
  }

  const { validate } = edit;
  return {
    kind: "text",
    ...base,
    value: isVarious ? "" : (valueText(shown[0]) ?? ""),
    isValid: validate === undefined ? undefined : (text) => validate(text) !== "error",
    onSave: change,
  };
};

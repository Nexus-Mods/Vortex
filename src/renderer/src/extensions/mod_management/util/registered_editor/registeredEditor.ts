import type { ITableAttribute } from "@/types/ITableAttribute";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";
import { valueText } from "../../hooks/use_registered_mods_columns/useRegisteredModsColumns.hook";
import type { IModWithState } from "../../types/IModProps";

/** What an extension's editable field is drawn as: a choice from a list, or text to type. */
export type RegisteredEditor = Extract<ModProperty, { kind: "select" | "text" }>;

/**
 * The editor an extension offers for its field, as the legacy details pane draws it: a choice from
 * its `choices`, else text checked by its `validate`, else plain text; none where it offers no
 * `onChangeValue`. Read-only where its `readOnly` says so for the first mod. A change goes to every
 * mod for a field that takes several, else to the one mod, as the legacy pane sends it.
 *
 * @param shown The field's values for the mods, in their order, which say whether they differ.
 */
export const registeredEditor = (
  attribute: ITableAttribute,
  mods: IModWithState[],
  shown: unknown[],
  label: string,
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
    isVarious: shown.some((value) => !Object.is(value, shown[0])),
    disabled: edit.readOnly?.(first) === true,
  };

  if (edit.choices !== undefined) {
    const choices = edit.choices(first).filter(({ visible }) => visible !== false);
    // Picked by its text, as the legacy pane matches the value to a choice.
    const picked = base.isVarious ? undefined : choices.find(({ text }) => text === shown[0]);
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
    value: base.isVarious ? "" : (valueText(shown[0]) ?? ""),
    isValid: validate === undefined ? undefined : (text) => validate(text) !== "error",
    onSave: change,
  };
};

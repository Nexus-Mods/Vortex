import React from "react";
import { useTranslation } from "react-i18next";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";
import {
  useRegisteredValues,
  valueCell,
  VersionedCustomCell,
} from "../../hooks/use_registered_mods_columns/useRegisteredModsColumns.hook";
import { registeredEditor } from "../../util/registered_editor/registeredEditor";
import { ModPropertyLabel } from "../mod_property_label/ModPropertyLabel";
import { ModPropertySelect } from "../mod_property_select/ModPropertySelect";
import { ModPropertyText } from "../mod_property_text/ModPropertyText";

interface IRegisteredModPropertyProps {
  property: Extract<ModProperty, { kind: "registered" }>;
}

/**
 * A field an extension registered for the legacy details pane, under its name, drawn as that pane
 * draws it: by its own renderer, given every selected mod if it takes several; in the editor the
 * extension offers; or its value as text, "Various" where the mods differ. One that isn't
 * volatile and has no value for the first mod isn't shown at all, as the legacy pane leaves it out,
 * whether it draws itself or is edited.
 */
export const RegisteredModProperty = ({ property }: IRegisteredModPropertyProps) => {
  const { attribute, label, mods } = property;
  const { t } = useTranslation("common");
  const shown = useRegisteredValues(attribute, mods, property.values);

  // As the legacy pane keeps an attribute only if it's volatile or has a value for the first mod.
  if (attribute.isVolatile !== true && shown[0] === undefined) {
    return null;
  }

  const isVarious = shown.some((value) => !Object.is(value, shown[0]));

  if (attribute.customRenderer === undefined) {
    const editor = registeredEditor(attribute, mods, shown, label, isVarious);
    // Made again for other mods, saving typing left unsaved to the mods it was typed for.
    const key = mods.map(({ id }) => id).join("\n");
    if (editor?.kind === "select") {
      return <ModPropertySelect property={editor} />;
    }
    if (editor?.kind === "text") {
      return <ModPropertyText key={key} property={editor} />;
    }
  }

  const content =
    attribute.customRenderer !== undefined ? (
      <VersionedCustomCell
        attribute={attribute}
        detail
        mod={attribute.supportsMultiple === true ? mods : mods[0]}
        t={t}
      />
    ) : (
      valueCell(isVarious ? t("Various") : shown[0], label)
    );

  return content === null ? null : (
    <ModPropertyLabel label={label} testId={`mod-property-${attribute.id}`}>
      {content}
    </ModPropertyLabel>
  );
};

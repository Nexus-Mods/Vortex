import React from "react";
import { useTranslation } from "react-i18next";

import { TextField } from "@/ui/components/form/text_field/TextField";

import { useUnsavedDraft } from "../../hooks/use_unsaved_draft/useUnsavedDraft.hook";
import { COMPACT_FIELD } from "../../util/compact_field/compactField";
import type { IRegisteredText } from "../../util/registered_editor/registeredEditor";

interface IModPropertyTextProps {
  property: IRegisteredText;
}

/**
 * Text to type, as an extension's field offers it, saved on leaving the box, or as other mods'
 * shows: only text its check takes, and only once it's changed. Empty, saying "Various", while
 * the mods differ.
 */
export const ModPropertyText = ({ property }: IModPropertyTextProps) => {
  const { t } = useTranslation("mod_management");
  const isSaveable = (text: string) => property.isValid?.(text) ?? true;
  const { draft, change, save } = useUnsavedDraft(property.value, (text) => {
    if (isSaveable(text) && text !== property.value) {
      property.onSave(text);
    }
  });
  const isValid = draft === property.value || isSaveable(draft);

  return (
    <TextField
      className="w-60"
      disabled={property.disabled}
      errorMessage={isValid ? undefined : t("modsTable::properties::invalid")}
      fieldClassName={COMPACT_FIELD}
      hideCharacterCount
      hints={property.hint}
      label={property.label}
      placeholder={property.isVarious ? t("modsTable::properties::various") : undefined}
      value={draft}
      onBlur={save}
      onChange={(event) => change(event.target.value)}
    />
  );
};

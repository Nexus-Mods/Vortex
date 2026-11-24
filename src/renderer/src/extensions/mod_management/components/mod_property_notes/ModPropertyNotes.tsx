import React from "react";
import { useTranslation } from "react-i18next";

import { TextAreaField } from "@/ui/components/form/text_area_field/TextAreaField";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";
import { useUnsavedDraft } from "../../hooks/use_unsaved_draft/useUnsavedDraft.hook";
import { COMPACT_HINTS } from "../../util/compact_field/compactField";

interface IModPropertyNotesProps {
  property: Extract<ModProperty, { kind: "notes" }>;
}

/**
 * Notes, typed here and saved on leaving the box, to the mods they were typed for. The box is the
 * panel's full width and starts three lines tall, growing with a long note up to 10rem, then
 * scrolls; the user can drag it taller or shorter within the same bounds. One made again with
 * typing unsaved saves it as it goes, to its own mods.
 */
export const ModPropertyNotes = ({ property }: IModPropertyNotesProps) => {
  const { t } = useTranslation("mod_management");
  const { draft, change, save } = useUnsavedDraft(property.value, (text) =>
    property.onSave(property.modIds, text),
  );

  return (
    <TextAreaField
      className="field-sizing-content max-h-40 min-h-15.5 resize-y overflow-y-auto"
      fieldClassName={COMPACT_HINTS}
      hints={property.hint}
      label={property.label}
      placeholder={property.isVarious ? t("modsTable::properties::various") : undefined}
      rows={3}
      value={draft}
      onBlur={save}
      onChange={(event) => change(event.target.value)}
    />
  );
};

import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { TextField } from "@/ui/components/form/text_field/TextField";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";
import { useUnsavedDraft } from "../../hooks/use_unsaved_draft/useUnsavedDraft.hook";
import { COMPACT_FIELD } from "../../util/compact_field/compactField";
import { isUrlValid } from "../../util/is_url_valid/isUrlValid";

/** Whether an address can be saved: a full one, or none to clear it. */
const isSaveable = (text: string) => text === "" || isUrlValid(text);

interface IModPropertyUrlProps {
  property: Extract<ModProperty, { kind: "url" }>;
}

/**
 * A website mod's address, saved on leaving the box, or as another mod's shows: only a full
 * address, or none to clear it. Beside it, a button opens a valid one in the browser.
 */
export const ModPropertyUrl = ({ property }: IModPropertyUrlProps) => {
  const { t } = useTranslation("mod_management");
  const { draft, change, save } = useUnsavedDraft(property.value, (text) => {
    if (isSaveable(text) && text !== property.value) {
      property.onSave(text);
    }
  });
  const isValid = isSaveable(draft);

  return (
    <div className="flex items-start gap-x-1">
      <TextField
        // On the input too, as an input without an icon isn't wrapped in a control.
        className="w-60"
        errorMessage={isValid ? undefined : t("modsTable::properties::websiteInvalid")}
        fieldClassName={COMPACT_FIELD}
        hideCharacterCount
        label={property.label}
        type="url"
        value={draft}
        onBlur={save}
        onChange={(event) => change(event.target.value)}
      />

      <Tooltip content={t("modsTable::properties::openWebsite")}>
        <Button
          appearance="weak"
          aria-label={t("modsTable::properties::openWebsite")}
          brand="neutral"
          // Level with the box, under its label.
          className="mt-6"
          data-testid="mod-property-open-website"
          disabled={draft === "" || !isValid}
          leftIcon="open_in_new"
          onClick={() => window.api.shell.openUrl(draft)}
        />
      </Tooltip>
    </div>
  );
};

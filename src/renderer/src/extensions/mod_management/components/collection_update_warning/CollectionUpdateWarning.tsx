import React, { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { CheckboxField } from "@/ui/components/form/checkbox_field/CheckboxField";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

import {
  answerCollectionUpdate,
  currentCollectionUpdatePrompt,
  subscribeToCollectionUpdatePrompts,
  type CollectionUpdatePrompt,
} from "../../util/collection_update_prompt/collectionUpdatePrompt";

const secondaryButton = { appearance: "moderate", brand: "neutral" } as const;

const WarningModal = ({ prompt }: { prompt: CollectionUpdatePrompt }) => {
  const { t } = useTranslation("mod_management");
  const [acknowledged, setAcknowledged] = useState(false);

  const isBatch = prompt.kind === "batch";
  const hasNonCollectionMods = isBatch && prompt.hasNonCollectionMods;
  const text = isBatch
    ? {
        title: t("collection_update_warning::batch::title"),
        intro: t("collection_update_warning::batch::intro"),
        curatorVersion: t("collection_update_warning::batch::curator_version"),
        caution: t("collection_update_warning::batch::caution"),
        acknowledge: t("collection_update_warning::batch::acknowledge"),
        confirm: t("collection_update_warning::batch::update_all"),
      }
    : {
        title: t("collection_update_warning::single::title"),
        intro: t("collection_update_warning::single::intro"),
        curatorVersion: t("collection_update_warning::single::curator_version"),
        caution: t("collection_update_warning::single::caution"),
        acknowledge: t("collection_update_warning::single::acknowledge"),
        confirm: t("collection_update_warning::single::update_anyway"),
      };

  return (
    <Modal isOpen size="md" title={text.title} onClose={() => answerCollectionUpdate("cancel")}>
      <div className="space-y-4">
        <div className="space-y-1">
          <Typography appearance="subdued" typographyType="body-sm">
            {text.intro}
          </Typography>

          <Typography as="ul" className="space-y-1 font-semibold" typographyType="body-sm">
            {prompt.collectionNames.map((name) => (
              <li key={name}>{name.trim()}</li>
            ))}
          </Typography>
        </div>

        <div className="space-y-2">
          <Typography appearance="subdued" typographyType="body-sm">
            {text.curatorVersion}
          </Typography>

          <Typography appearance="subdued" typographyType="body-sm">
            {text.caution}
          </Typography>
        </div>

        <CheckboxField checked={acknowledged} label={text.acknowledge} onChange={setAcknowledged} />
      </div>

      <div className="mt-4 flex justify-end gap-x-2">
        <Button
          {...secondaryButton}
          data-testid="collection-update-cancel"
          onClick={() => answerCollectionUpdate("cancel")}
        >
          {t("collection_update_warning::cancel")}
        </Button>

        <Button
          {...(hasNonCollectionMods ? secondaryButton : undefined)}
          data-testid="collection-update-confirm"
          disabled={!acknowledged}
          onClick={() => answerCollectionUpdate("all")}
        >
          {text.confirm}
        </Button>

        {hasNonCollectionMods && (
          <Button
            data-testid="collection-update-non-collection"
            onClick={() => answerCollectionUpdate("non-collection")}
          >
            {t("collection_update_warning::batch::update_non_collection")}
          </Button>
        )}
      </div>
    </Modal>
  );
};

/**
 * Asks before updating mods that belong to a collection. Mounted once as an extension dialog; it
 * shows whichever prompt `askCollectionUpdate` has queued, a fresh one each time so the
 * confirmation box always starts unticked. It ignores the `visible` and `onHide` props the dialog
 * container passes and is shown only while a prompt is waiting.
 */
export const CollectionUpdateWarning = () => {
  const pending = useSyncExternalStore(
    subscribeToCollectionUpdatePrompts,
    currentCollectionUpdatePrompt,
  );

  return pending === undefined ? null : <WarningModal key={pending.id} prompt={pending.prompt} />;
};

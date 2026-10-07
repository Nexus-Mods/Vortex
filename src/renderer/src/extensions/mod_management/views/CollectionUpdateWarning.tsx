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
} from "../util/collectionUpdatePrompt";

const WarningModal = ({ prompt }: { prompt: CollectionUpdatePrompt }) => {
  const { t } = useTranslation("mod_management");
  const [acknowledged, setAcknowledged] = useState(false);

  const isBatch = prompt.kind === "batch";

  return (
    <Modal
      isOpen
      size="md"
      title={
        isBatch
          ? t("collection_update_warning::batch::title")
          : t("collection_update_warning::single::title")
      }
      onClose={() => answerCollectionUpdate("cancel")}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <Typography appearance="subdued" typographyType="body-sm">
            {isBatch
              ? t("collection_update_warning::batch::intro")
              : t("collection_update_warning::single::intro")}
          </Typography>

          <ul className="space-y-1">
            {prompt.collectionNames.map((name) => (
              <li key={name}>
                <Typography as="span" className="font-semibold" typographyType="body-sm">
                  {name.trim()}
                </Typography>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <Typography appearance="subdued" typographyType="body-sm">
            {isBatch
              ? t("collection_update_warning::batch::warning")
              : t("collection_update_warning::single::warning")}
          </Typography>

          {isBatch && (
            <Typography typographyType="body-sm">
              <span className="font-semibold">
                {t("collection_update_warning::batch::recommended")}
              </span>{" "}
              {t("collection_update_warning::batch::recommended_action")}
            </Typography>
          )}
        </div>

        <CheckboxField
          checked={acknowledged}
          label={
            isBatch
              ? t("collection_update_warning::batch::acknowledge")
              : t("collection_update_warning::single::acknowledge")
          }
          onChange={setAcknowledged}
        />
      </div>

      <div className="mt-4 flex justify-end gap-x-2">
        <Button
          appearance="moderate"
          brand="neutral"
          data-testid="collection-update-cancel"
          onClick={() => answerCollectionUpdate("cancel")}
        >
          {t("collection_update_warning::cancel")}
        </Button>

        <Button
          {...(isBatch && { appearance: "moderate", brand: "neutral" })}
          data-testid="collection-update-confirm"
          disabled={!acknowledged}
          onClick={() => answerCollectionUpdate("all")}
        >
          {isBatch
            ? t("collection_update_warning::batch::update_all")
            : t("collection_update_warning::single::update_anyway")}
        </Button>

        {isBatch && (
          <Button
            data-testid="collection-update-non-collection"
            disabled={!prompt.hasNonCollectionMods}
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
 * confirmation box always starts unticked.
 */
export const CollectionUpdateWarning = () => {
  const pending = useSyncExternalStore(
    subscribeToCollectionUpdatePrompts,
    currentCollectionUpdatePrompt,
  );

  return pending === undefined ? null : <WarningModal key={pending.id} prompt={pending.prompt} />;
};

import { mdiTrayArrowDown } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Markdown } from "@/ui/components/markdown/Markdown";
import { ToolbarButton } from "@/ui/components/toolbar/ToolbarButton";

import { useCollectionRevision } from "../../hooks/use_collection_revision/useCollectionRevision.hook";
import type { IMod } from "../../types/IMod";
import { ChangelogButton } from "../changelog_button/ChangelogButton";
import { VersionText } from "../version_text/VersionText";

interface ICollectionRevisionProps {
  /** The installed collection. */
  collection: IMod;
}

/**
 * An installed collection's revision, then a button to update it while a newer one is out,
 * and one that opens the newest revision's changelog while it has one.
 */
export const CollectionRevision = ({ collection }: ICollectionRevisionProps) => {
  const { t } = useTranslation(["common"]);
  const { revision, newest, hasUpdate, update, updating, changelog } =
    useCollectionRevision(collection);

  return (
    <div className="flex min-w-0 items-center gap-x-2">
      <VersionText fixed={hasUpdate || !!changelog} version={revision ? String(revision) : "-"} />

      {(hasUpdate || !!changelog) && (
        <div className="flex shrink-0 items-center gap-x-1">
          {hasUpdate && (
            <ToolbarButton
              appearance="moderate"
              brand="info"
              isLoading={updating}
              label={t("Update to {{revision}}", { revision: newest })}
              leftIconPath={mdiTrayArrowDown}
              size="sm"
              onClick={() => void update()}
            />
          )}

          {!!changelog && (
            <ChangelogButton>
              <Markdown markdown={changelog} size="sm" />
            </ChangelogButton>
          )}
        </div>
      )}
    </div>
  );
};

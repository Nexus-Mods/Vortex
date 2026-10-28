import React from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "@/ui/components/icon/Icon";
import { Markdown } from "@/ui/components/prose/markdown/Markdown";
import { PlainText } from "@/ui/components/prose/plain_text/PlainText";
import { ToolbarButton } from "@/ui/components/toolbar/ToolbarButton";

import {
  useCollectionChangelog,
  useCollectionRevision,
} from "../../hooks/use_collection_revision/useCollectionRevision.hook";
import type { IMod } from "../../types/IMod";
import { ChangelogButton } from "../changelog_button/ChangelogButton";
import { VersionText } from "../version_text/VersionText";

interface ICollectionRevisionProps {
  /** The installed collection. */
  collection: IMod;
}

/**
 * An installed collection's revision, then, while a newer one is out, a button to update to
 * it and one that opens its changelog.
 */
export const CollectionRevision = ({ collection }: ICollectionRevisionProps) => {
  const { t } = useTranslation(["common"]);
  const { revision, newest, hasUpdate, update, updating } = useCollectionRevision(collection);
  const slug: string | undefined = collection.attributes?.collectionSlug;

  return (
    <div className="flex min-w-0 items-center gap-x-2">
      <VersionText fixed={hasUpdate} version={revision ? String(revision) : "-"} />

      {hasUpdate && (
        <div className="flex shrink-0 items-center gap-x-1">
          <ToolbarButton
            appearance="moderate"
            brand="info"
            isLoading={updating}
            label={t("Update to {{revision}}", { revision: newest })}
            leftIcon="download"
            size="sm"
            onClick={() => void update()}
          />

          {!!slug && (
            <ChangelogButton>
              <CollectionChangelog revision={newest} slug={slug} />
            </ChangelogButton>
          )}
        </div>
      )}
    </div>
  );
};

/** A revision's changelog, fetched as its popover opens, as the panel mounts it then. */
const CollectionChangelog = ({ slug, revision }: { slug: string; revision: number }) => {
  const { t } = useTranslation(["common"]);
  const changelog = useCollectionChangelog(slug, revision);

  switch (changelog.status) {
    case "loading":
      return (
        <span
          aria-label={t("Loading changelog")}
          className="relative flex size-4 animate-spin text-neutral-subdued"
          role="status"
        >
          <Icon className="opacity-40" name="radio_button_unchecked" size="sm" />

          <Icon className="absolute inset-0" name="progress_activity" size="sm" />
        </span>
      );
    case "failed":
      return <PlainText size="sm" text={t("Couldn't load the changelog")} />;
    case "loaded":
      if (changelog.changelog) {
        return <Markdown markdown={changelog.changelog} size="sm" />;
      }

      return <PlainText size="sm" text={t("No changelog for this revision")} />;
  }
};

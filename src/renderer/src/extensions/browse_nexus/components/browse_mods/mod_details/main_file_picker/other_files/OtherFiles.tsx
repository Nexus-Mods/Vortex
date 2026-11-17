import type { IFileInfo } from "@nexusmods/nexus-api";
import { NexusGameDomain } from "@vortex/shared";
import type { TFunction } from "i18next";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { shallowEqual, useSelector } from "react-redux";

import {
  gameDomains,
  modInstallGroups,
} from "@/extensions/browse_nexus/hooks/use_mod_install_state/modInstallSelectors";
import { modKey } from "@/extensions/browse_nexus/util/mod_install_state/modInstallState";
import {
  type OtherFileCategory,
  otherFilesOf,
} from "@/extensions/browse_nexus/util/other_files/otherFiles";
import {
  showDownloadOnModsPage,
  showModOnModsPage,
} from "@/extensions/mod_management/util/show_mod_on_mods_page/showModOnModsPage";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { activeGameId } from "@/util/selectors";

/** The ids of a mod's own mods and downloads, as `modInstallGroups` files them; none for none. */
const groupOf = (state: IState, key: string) => modInstallGroups(state)?.get(key);

/** A selector for a mod's own mods in the active game. */
const ownModsOf = (key: string) => (state: IState) => {
  const mods = state.persistent.mods[activeGameId(state)] ?? {};
  return Object.fromEntries((groupOf(state, key)?.mods ?? []).map((id) => [id, mods[id]]));
};

/** A selector for a mod's own finished downloads, so another's progress doesn't re-render. */
const finishedDownloadsOf = (key: string) => (state: IState) => {
  const downloads = state.persistent.downloads.files;
  const ids = (groupOf(state, key)?.downloads ?? []).filter(
    (id) => downloads[id]?.state === "finished",
  );
  return Object.fromEntries(ids.map((id) => [id, downloads[id]]));
};

/** A category's heading, for how many of its files the user has. */
const headingOf = (t: TFunction, category: OtherFileCategory, count: number) => {
  switch (category) {
    case "OPTIONAL":
      return t("You have {{count}} optional file downloaded:", { count });
    case "MISCELLANEOUS":
      return t("You have {{count}} miscellaneous file downloaded:", { count });
    case "UPDATE":
      return t("You have {{count}} update file downloaded:", { count });
    case "OLD_VERSION":
      return t("You have {{count}} old version downloaded:", { count });
    case "ARCHIVED":
      return t("You have {{count}} archived file downloaded:", { count });
  }
};

interface IOtherFilesProps {
  api: IExtensionApi;
  /** The mod the files are of. */
  mod: ModSummary;
  /** All of its files, as the site lists them now. */
  files: IFileInfo[];
  /** Closes the picker, as a file's link takes the user to the Mods page. */
  onLeave: () => void;
}

/**
 * The files the user has of a mod that aren't Main files, a heading per category and a link per
 * file to its row on the Mods page; nothing when they have none. Reads only the mod's own mods
 * and finished downloads, so a download's progress doesn't re-render it.
 */
export const OtherFiles = ({ api, mod, files, onLeave }: IOtherFilesProps) => {
  const { t } = useTranslation();
  const domain = NexusGameDomain(mod.game.domain_name);
  const modId = Number(mod.game_scoped_id);
  const key = modKey(domain, modId);
  const selectMods = useMemo(() => ownModsOf(key), [key]);
  const selectDownloads = useMemo(() => finishedDownloadsOf(key), [key]);
  const mods = useSelector(selectMods, shallowEqual);
  const downloads = useSelector(selectDownloads, shallowEqual);
  const gameId = useSelector(activeGameId);
  const domainOf = useSelector(gameDomains);

  const groups = useMemo(() => {
    if (!gameId) {
      return [];
    }

    return otherFilesOf({ mods, downloads, gameId, domainOf }, { domain, modId }, files);
  }, [mods, downloads, gameId, domainOf, domain, modId, files]);

  if (!groups.length) {
    return null;
  }

  return (
    <div className="space-y-4" data-testid="other-files">
      {groups.map((group) => (
        <div
          className="space-y-2"
          data-testid={`other-files-${group.category}`}
          key={group.category}
        >
          <Typography appearance="moderate" typographyType="body-sm">
            {headingOf(t, group.category, group.files.length)}
          </Typography>

          <ul className="space-y-2">
            {group.files.map((file) => (
              <li key={file.modId ?? file.downloadId}>
                <TypographyLink
                  appearance="subdued"
                  data-testid={`other-file-${file.modId ?? file.downloadId}`}
                  typographyType="body-sm"
                  onClick={() => {
                    onLeave();

                    if (file.modId) {
                      showModOnModsPage(api, file.modId);
                      return;
                    }

                    showDownloadOnModsPage(api, file.downloadId);
                  }}
                >
                  {file.name}
                </TypographyLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

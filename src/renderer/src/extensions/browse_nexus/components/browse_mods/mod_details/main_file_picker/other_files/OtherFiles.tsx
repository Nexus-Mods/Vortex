import type { IFileInfo } from "@nexusmods/nexus-api";
import { NexusGameDomain, VortexModId } from "@vortex/shared";
import type { TFunction } from "i18next";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { gameDomains } from "@/extensions/browse_nexus/hooks/use_mod_install_state/modInstallSelectors";
import {
  type OtherFileCategory,
  otherFilesOf,
} from "@/extensions/browse_nexus/util/other_files/otherFiles";
import type { IMod } from "@/extensions/mod_management/types/IMod";
import { showModOnModsPage } from "@/extensions/mod_management/util/show_mod_on_mods_page/showModOnModsPage";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { activeGameId } from "@/util/selectors";

const NO_MODS: { [modId: string]: IMod } = {};

const activeMods = (state: IState) => state.persistent.mods[activeGameId(state)] ?? NO_MODS;

const allDownloads = (state: IState) => state.persistent.downloads.files;

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
 * file to its row on the Mods page; nothing when they have none. A download that isn't installed
 * has a row of its own there, keyed by the download's id.
 */
export const OtherFiles = ({ api, mod, files, onLeave }: IOtherFilesProps) => {
  const { t } = useTranslation();
  const mods = useSelector(activeMods);
  const downloads = useSelector(allDownloads);
  const gameId = useSelector(activeGameId);
  const domainOf = useSelector(gameDomains);

  const groups = useMemo(() => {
    if (!gameId) {
      return [];
    }

    return otherFilesOf(
      { mods, downloads, gameId, domainOf },
      { domain: NexusGameDomain(mod.game.domain_name), modId: Number(mod.game_scoped_id) },
      files,
    );
  }, [mods, downloads, gameId, domainOf, mod, files]);

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
              <li key={file.rowId}>
                <TypographyLink
                  appearance="subdued"
                  data-testid={`other-file-${file.rowId}`}
                  typographyType="body-sm"
                  onClick={() => {
                    onLeave();
                    showModOnModsPage(api, VortexModId(file.rowId));
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

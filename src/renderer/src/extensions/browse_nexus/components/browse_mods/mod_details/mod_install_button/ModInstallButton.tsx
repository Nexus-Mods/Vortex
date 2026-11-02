import { useIsMutating, useMutation } from "@tanstack/react-query";
import { GameDomain, VortexGameId } from "@vortex/shared";
import type { TFunction } from "i18next";
import React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { MinimalModFileVersion } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { isPremium } from "@/extensions/nexus_integration/selectors";
import {
  downloadAndInstallNexusFile,
  downloadNexusFile,
} from "@/extensions/nexus_integration/util/download_and_install/downloadAndInstall";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { ProcessCanceled, UserCanceled } from "@/util/CustomErrors";
import { activeGameId } from "@/util/selectors";

import { useBrowseModsTracker } from "../../../../hooks/browse_mods_tracking/BrowseModsTracking.context";

/** Why the mod can't be installed, said in the tooltip; none while it can, or is loading. */
const unavailableReason = (
  t: TFunction,
  primaryFile: MinimalModFileVersion | null | undefined,
  isError: boolean,
) => {
  if (isError) {
    return t("Couldn't load this mod's files");
  }

  if (primaryFile === null) {
    return t("This mod has no file to download");
  }

  return undefined;
};

/** Whether the user has mods installed once they're downloaded, as their settings say. */
const installsWhenDownloaded = (state: IState) => state.settings.automation.install;

interface IModInstallButtonProps {
  api: IExtensionApi;
  /** The mod to download, and install. */
  mod: ModSummary;
  /** Its primary file, the one downloaded; null when it has none, absent while its details load. */
  primaryFile?: MinimalModFileVersion | null;
  /** Whether its details failed to load, so whether it has a primary file isn't known. */
  isError?: boolean;
}

/**
 * 1-click download of a mod's primary file, for Premium users only, installing it too if the user
 * has mods installed once downloaded, and saying which. Off while the mod's details load, and off
 * with a tooltip saying why when they failed to load or the mod has no primary file. Shows its
 * progress until it's done, even after switching to another mod and back, as it's a mutation keyed
 * by the mod. Counts the click; failures are reported, cancelling isn't.
 */
export const ModInstallButton = ({
  api,
  mod,
  primaryFile,
  isError = false,
}: IModInstallButtonProps) => {
  const { t } = useTranslation();
  const tracker = useBrowseModsTracker();
  const isPremiumUser = useSelector(isPremium);
  const gameId = useSelector(activeGameId);
  const shouldInstall = !!useSelector(installsWhenDownloaded);
  const unavailable = unavailableReason(t, primaryFile, isError);
  const installKey = ["browse", "install", mod.id];
  const isInstalling = useIsMutating({ mutationKey: installKey }) > 0;

  const install = useMutation({
    mutationKey: installKey,
    mutationFn: ({ file, game }: { file: MinimalModFileVersion; game: string }) => {
      const nexusFile = {
        gameDomain: GameDomain(mod.game.domain_name),
        gameId: VortexGameId(game),
        modId: mod.game_scoped_id,
        fileId: file.game_scoped_id,
        name: mod.name,
      };

      return shouldInstall
        ? downloadAndInstallNexusFile(api, nexusFile)
        : downloadNexusFile(api, nexusFile);
    },
    onError: (err) => {
      if (err instanceof UserCanceled || err instanceof ProcessCanceled) {
        return;
      }

      const title = shouldInstall
        ? t("Failed to install {{name}}", { name: mod.name })
        : t("Failed to download {{name}}", { name: mod.name });

      api.showErrorNotification(title, err, { allowReport: false });
    },
  });

  if (!isPremiumUser) {
    return null;
  }

  return (
    <Tooltip content={unavailable} disabled={!unavailable}>
      <Button
        aria-disabled={!!unavailable}
        disabled={primaryFile === undefined && !isError}
        isLoading={isInstalling}
        leftIcon="download"
        onClick={() => {
          if (!primaryFile || !gameId) {
            return;
          }

          tracker.trackOneClickClicked({
            mod_uid: mod.id,
            file_uid: primaryFile.id,
            action: shouldInstall ? "install" : "download",
          });
          install.mutate({ file: primaryFile, game: gameId });
        }}
      >
        {shouldInstall ? t("1-click install") : t("1-click download")}
      </Button>
    </Tooltip>
  );
};

import { useIsMutating, useMutation } from "@tanstack/react-query";
import { GameDomain, VortexGameId } from "@vortex/shared";
import { VortexError, type VortexErrorKind } from "@vortex/shared/errors";
import type { TFunction } from "i18next";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { PremiumUpsellModal } from "@/extensions/nexus_integration/components/premium_upsell_modal/PremiumUpsellModal";
import { NEXUS_BASE_URL } from "@/extensions/nexus_integration/constants";
import type { MinimalModFileVersion } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { isPremium } from "@/extensions/nexus_integration/selectors";
import {
  downloadAndInstallNexusFile,
  downloadNexusFile,
} from "@/extensions/nexus_integration/util/download_and_install/downloadAndInstall";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { PremiumBadge } from "@/ui/components/badges/premium_badge/PremiumBadge";
import { Button } from "@/ui/components/button/Button";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { activeGameId } from "@/util/selectors";
import { Content } from "@/util/util";

import { useBrowseModsTracker } from "../../../../hooks/browse_mods_tracking/BrowseModsTracking.context";

/** Error kinds that mean the download was cancelled, which isn't reported. */
const CANCELED_KINDS: VortexErrorKind[] = ["user-canceled", "process-canceled"];

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
 * 1-click install of a mod's primary file; only downloads if the user's settings don't install
 * once downloaded. Non-Premium users get the upsell instead. Progress survives switching mods.
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
  const [isUpsellOpen, setIsUpsellOpen] = useState(false);
  const unavailable = unavailableReason(t, primaryFile, isError);
  const installKey = ["browse", "install", mod.id];
  const isInstalling = useIsMutating({ mutationKey: installKey }) > 0;
  const action = shouldInstall ? "install" : "download";

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
    onMutate: ({ file }) =>
      tracker.trackOneClickClicked({ mod_uid: mod.id, file_uid: file.id, action }),
    onError: (err) => {
      if (err instanceof VortexError && CANCELED_KINDS.includes(err.data.kind)) {
        return;
      }

      const title = shouldInstall
        ? t("Failed to install {{name}}", { name: mod.name })
        : t("Failed to download {{name}}", { name: mod.name });

      api.showErrorNotification(title, err, { allowReport: false });
    },
  });

  return (
    <>
      <Tooltip content={unavailable} disabled={!unavailable}>
        <Button
          aria-disabled={!!unavailable}
          brand={isPremiumUser ? "primary" : "neutral"}
          disabled={primaryFile === undefined && !isError}
          isLoading={isInstalling}
          leftIcon="download"
          rightIcon={isPremiumUser ? undefined : <PremiumBadge />}
          onClick={() => {
            if (!primaryFile || !gameId) {
              return;
            }

            if (isPremiumUser) {
              install.mutate({ file: primaryFile, game: gameId });
              return;
            }

            setIsUpsellOpen(true);
          }}
        >
          {t("1-click install")}
        </Button>
      </Tooltip>

      <PremiumUpsellModal
        api={api}
        content={Content.BrowseModsAd}
        description={t(
          "1-click in app installs are a Premium feature.\n\nFree users download through the website mod pages where ads help keep the platform running.",
        )}
        fallbackIcon="open_in_new"
        fallbackLabel={t("Install via mod page (free)")}
        isOpen={isUpsellOpen}
        title={t("Skip the website and install instantly.")}
        onClose={() => setIsUpsellOpen(false)}
        onDismissed={() => tracker.trackPremiumModalDismissed({ mod_uid: mod.id, action })}
        onFallback={() => {
          tracker.trackPremiumModalFallbackClicked({ mod_uid: mod.id, action });
          setIsUpsellOpen(false);

          if (primaryFile) {
            window.api.shell.openUrl(
              `${[NEXUS_BASE_URL, mod.game.domain_name, "mods", mod.game_scoped_id].join("/")}?tab=files&file_id=${primaryFile.game_scoped_id}&nmm=1`,
            );
          }
        }}
        onPremiumUnlocked={() => {
          if (primaryFile && gameId) {
            install.mutate({ file: primaryFile, game: gameId });
          }
        }}
        onShown={() => tracker.trackPremiumModalShown({ mod_uid: mod.id, action })}
        onUnlockClicked={() => tracker.trackPremiumModalUnlockClicked({ mod_uid: mod.id, action })}
      />
    </>
  );
};

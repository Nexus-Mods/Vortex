import { useIsMutating, useMutation } from "@tanstack/react-query";
import { GameDomain, VortexGameId, VortexModId } from "@vortex/shared";
import { VortexError, type VortexErrorKind } from "@vortex/shared/errors";
import type { TFunction } from "i18next";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { showModOnModsPage } from "@/extensions/mod_management/util/show_mod_on_mods_page/showModOnModsPage";
import { updateMod } from "@/extensions/mod_management/util/update_mod/updateMod";
import { PremiumUpsellModal } from "@/extensions/nexus_integration/components/premium_upsell_modal/PremiumUpsellModal";
import type { MinimalModFileVersion } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { isPremium } from "@/extensions/nexus_integration/selectors";
import {
  downloadAndInstallNexusFile,
  downloadNexusFile,
} from "@/extensions/nexus_integration/util/download_and_install/downloadAndInstall";
import { nexusModFilesUrl } from "@/extensions/nexus_integration/util/nexus_urls/nexusUrls";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { PremiumBadge } from "@/ui/components/badges/premium_badge/PremiumBadge";
import { Button } from "@/ui/components/button/Button";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { nxmModOutline } from "@/ui/icon-paths";
import { activeGameId } from "@/util/selectors";
import { Content } from "@/util/util";

import { useBrowseModsTracker } from "../../../../hooks/browse_mods_tracking/BrowseModsTracking.context";
import { useModInstallState } from "../../../../hooks/use_mod_install_state/useModInstallState.hook";

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
    return t("This mod isn't available through Vortex. Download it from Nexus Mods instead.");
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
 * The details' button for what the user has of a mod: View installed mod once it's installed,
 * Update while the Mods page's update check offers one, Install for a download, and otherwise
 * 1-click install of its primary file, which only downloads if the user's settings don't install
 * once downloaded. Non-Premium users get the 1-click upsell for an update as for an install, its
 * events saying which. Progress survives switching mods.
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
  const domain = GameDomain(mod.game.domain_name);
  const installState = useModInstallState({ domain, modId: Number(mod.game_scoped_id) });
  const action = shouldInstall ? "install" : "download";
  const upsellAction = installState.kind === "installed" ? "update" : action;

  const install = useMutation({
    mutationKey: installKey,
    mutationFn: ({ file, game }: { file: MinimalModFileVersion; game: string }) => {
      const nexusFile = {
        gameDomain: domain,
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

  const runUpdate = () => {
    if (installState.kind !== "installed" || !installState.update) {
      return;
    }

    const { attributes } = installState.mod;
    const downloadGame = attributes?.downloadGame ?? gameId;

    if (!downloadGame) {
      return;
    }

    const game = VortexGameId(downloadGame);

    if (installState.update === "update-site") {
      api.events.emit("open-mod-page", game, attributes?.modId, attributes?.source);
      return;
    }

    void updateMod(api, installState.mod, game);
  };

  /** 1-click install, which keeps showing its progress until its install is done. */
  const oneClick = () => (
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
  );

  /**
   * The button for what the user has of the mod; the upsell beside it stays put as it changes.
   * 1-click install holds while it runs, as between its download finishing and its install
   * starting the mod reads as downloaded.
   */
  const control = () => {
    if (isInstalling) {
      return oneClick();
    }

    if (installState.kind === "installing") {
      return (
        <Button disabled isLoading leftIcon="add">
          {t("Install")}
        </Button>
      );
    }

    if (installState.kind === "installed" && !installState.update) {
      const modId = VortexModId(installState.mod.id);

      return (
        <Button
          brand="neutral"
          leftIcon={{ path: nxmModOutline }}
          onClick={() => {
            tracker.trackViewInstalledClicked({ mod_uid: mod.id });
            showModOnModsPage(api, modId);
          }}
        >
          {t("View installed mod")}
        </Button>
      );
    }

    if (installState.kind === "installed" && isPremiumUser) {
      return (
        <Button
          leftIcon="download"
          onClick={() => {
            tracker.trackUpdateClicked({ mod_uid: mod.id });
            runUpdate();
          }}
        >
          {t("Update")}
        </Button>
      );
    }

    if (installState.kind === "downloaded") {
      const { downloadId } = installState;

      return (
        <Button
          leftIcon="add"
          onClick={() => {
            tracker.trackInstallClicked({ mod_uid: mod.id });
            api.events.emit("start-install-download", downloadId);
          }}
        >
          {t("Install")}
        </Button>
      );
    }

    return oneClick();
  };

  return (
    <>
      {control()}

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
        onDismissed={() =>
          tracker.trackPremiumModalDismissed({ mod_uid: mod.id, action: upsellAction })
        }
        onFallback={() => {
          tracker.trackPremiumModalFallbackClicked({ mod_uid: mod.id, action: upsellAction });
          setIsUpsellOpen(false);

          window.api.shell.openUrl(nexusModFilesUrl(domain, mod.game_scoped_id));
        }}
        onPremiumUnlocked={() => {
          if (installState.kind === "installed") {
            runUpdate();
            return;
          }

          if (primaryFile && gameId) {
            install.mutate({ file: primaryFile, game: gameId });
          }
        }}
        onShown={() => tracker.trackPremiumModalShown({ mod_uid: mod.id, action: upsellAction })}
        onUnlockClicked={() =>
          tracker.trackPremiumModalUnlockClicked({ mod_uid: mod.id, action: upsellAction })
        }
      />
    </>
  );
};

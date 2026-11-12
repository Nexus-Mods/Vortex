import { PopoverButton as HeadlessPopoverButton } from "@headlessui/react";
import type { IFileInfo } from "@nexusmods/nexus-api";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { GameDomain, VortexGameId, VortexModId } from "@vortex/shared";
import type { TFunction } from "i18next";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { showModOnModsPage } from "@/extensions/mod_management/util/show_mod_on_mods_page/showModOnModsPage";
import { updateMod } from "@/extensions/mod_management/util/update_mod/updateMod";
import { PremiumUpsellModal } from "@/extensions/nexus_integration/components/premium_upsell_modal/PremiumUpsellModal";
import type { ModMainFileVersion } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { isPremium } from "@/extensions/nexus_integration/selectors";
import { nexusModFilesUrl } from "@/extensions/nexus_integration/util/nexus_urls/nexusUrls";
import { makeFileUID } from "@/extensions/nexus_integration/util/UIDs";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { PremiumBadge } from "@/ui/components/badges/premium_badge/PremiumBadge";
import { Button } from "@/ui/components/button/Button";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { SplitButton, SplitButtonAction } from "@/ui/components/split_button/SplitButton";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { nxmModOutline } from "@/ui/icon-paths";
import { activeGameId } from "@/util/selectors";
import { Content } from "@/util/util";

import { useBrowseModsTracker } from "../../../../hooks/browse_mods_tracking/BrowseModsTracking.context";
import { mainFilesQuery } from "../../../../queries/main_files/mainFiles.query";
import {
  installNexusFile,
  installsWhenDownloaded,
  reportInstallFailure,
} from "../../../../util/install_nexus_file/installNexusFile";
import type { ModInstallState } from "../../../../util/mod_install_state/modInstallState";
import { oneClickInstallKey } from "../../../../util/one_click_install/oneClickInstall";
import { MainFilePicker } from "../main_file_picker/MainFilePicker";

/** The file 1-click installs: its UID, for tracking, and its id within the mod. */
type IInstallFile = Pick<ModMainFileVersion, "id" | "game_scoped_id">;

/**
 * Why the mod can't be installed, said in the tooltip; none while it can, or is loading. An update
 * never needs its main file, so nothing stops one.
 */
const unavailableReason = (
  t: TFunction,
  isError: boolean,
  hasNoFiles: boolean,
  hasUpdate: boolean,
) => {
  if (hasUpdate) {
    return undefined;
  }

  if (isError) {
    return t("Couldn't load this mod's files");
  }

  if (hasNoFiles) {
    return t("This mod isn't available through Vortex. Download it from Nexus Mods instead.");
  }

  return undefined;
};

/**
 * What 1-click and its Premium upsell say: worded for an update when the user has the mod with one,
 * and otherwise for installing it. The upsell's Premium button keeps its own label for an install.
 */
const oneClickText = (t: TFunction, isUpdate: boolean) =>
  isUpdate
    ? {
        button: t("1-click update"),
        title: t("Skip the website and update instantly."),
        description: t(
          "1-click in app updates are a Premium feature.\n\nFree users download through the website mod pages where ads help keep the platform running.",
        ),
        fallbackLabel: t("Update via mod page (free)"),
        unlockLabel: t("Unlock 1-click updates"),
      }
    : {
        button: t("1-click install"),
        title: t("Skip the website and install instantly."),
        description: t(
          "1-click in app installs are a Premium feature.\n\nFree users download through the website mod pages where ads help keep the platform running.",
        ),
        fallbackLabel: t("Install via mod page (free)"),
        unlockLabel: undefined,
      };

interface IModInstallButtonProps {
  api: IExtensionApi;
  /** The mod to download, and install. */
  mod: ModSummary;
  /** Its file from v3; null or not primary when the user chooses; absent while it loads. */
  mainFile?: ModMainFileVersion | null;
  /** Whether its details failed to load, so whether it has a main file isn't known. */
  isError?: boolean;
  /** What the user has of it, from `useModStatus`. */
  installState: ModInstallState;
}

/**
 * The details' button for what the user has of a mod: View installed mod once it's installed,
 * Update while the Mods page's update check offers one, Install for a download, and otherwise
 * 1-click install of its main file, which only downloads if the user's settings don't install
 * once downloaded. Non-Premium users get the 1-click upsell for an update as for an install, its
 * events saying which. Progress survives switching mods.
 *
 * A mod with no primary file has its Main files fetched on click: one is installed, more open the
 * picker. Once the user has the mod, its button splits, its menu reaching the picker again; with
 * several of its files downloaded or installed, a Premium user's main action opens the picker too.
 */
export const ModInstallButton = ({
  api,
  mod,
  mainFile,
  isError = false,
  installState,
}: IModInstallButtonProps) => {
  const { t } = useTranslation();
  const tracker = useBrowseModsTracker();
  const isPremiumUser = useSelector(isPremium);
  const gameId = useSelector(activeGameId);
  const shouldInstall = !!useSelector(installsWhenDownloaded);
  const [upsellFor, setUpsellFor] = useState<"one-click" | "menu">();
  const queryClient = useQueryClient();
  const [pickerFiles, setPickerFiles] = useState<IFileInfo[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const mainButtonRef = useRef<HTMLButtonElement>(null);
  const installKey = oneClickInstallKey(mod.id);
  const isInstalling = useIsMutating({ mutationKey: installKey }) > 0;
  const domain = GameDomain(mod.game.domain_name);
  const action = shouldInstall ? "install" : "download";
  const hasUpdate = installState.kind === "installed" && !!installState.update;
  const isLoadingFile = !hasUpdate && mainFile === undefined && !isError;
  /** v3 gives a mod with no primary its newest Main file, not primary; either way, choose. */
  const choosesFile = mainFile === null || mainFile?.is_primary === false;
  const upsellAction = hasUpdate ? "update" : action;
  const { button: oneClickLabel, ...upsellText } = oneClickText(t, hasUpdate);

  const install = useMutation({
    mutationKey: installKey,
    mutationFn: ({ file, game }: { file: IInstallFile; game: string }) =>
      installNexusFile(api, {
        mod,
        fileId: file.game_scoped_id,
        gameId: VortexGameId(game),
        shouldInstall,
      }),
    onMutate: ({ file }) =>
      tracker.trackOneClickClicked({ mod_uid: mod.id, file_uid: file.id, action }),
    onError: (error) => reportInstallFailure(api, { t, mod, shouldInstall, error }),
  });

  const mainFiles = useMutation({
    mutationFn: () => queryClient.fetchQuery(mainFilesQuery(api, { mod })),
  });
  const hasNoFiles = mainFiles.data?.length === 0;
  const unavailable = unavailableReason(t, isError, hasNoFiles, hasUpdate);
  const filesError = mainFiles.isError ? t("Couldn't load this mod's files") : undefined;

  /**
   * Fetches the mod's Main files, then installs the only one, or opens the picker on several. From
   * the split button the picker opens on any, and a failure or no files is said in a notification.
   * `source` is what the picker's opening is tracked as.
   */
  const chooseFile = (source: "install" | "menu", fromSplit = source === "menu") => {
    if (!gameId) {
      return;
    }

    mainFiles.mutate(undefined, {
      onError: (error) => {
        if (fromSplit) {
          api.showErrorNotification(t("Couldn't load this mod's files"), error, {
            allowReport: false,
          });
        }
      },
      onSuccess: (files) => {
        const [only] = files;

        if (files.length === 0 && fromSplit) {
          api.sendNotification({
            type: "info",
            message: t(
              "This mod isn't available through Vortex. Download it from Nexus Mods instead.",
            ),
          });
          return;
        }

        if (files.length === 1 && !fromSplit) {
          install.mutate({
            file: {
              id: makeFileUID({ gameId: String(mod.game.id), fileId: String(only.file_id) }),
              game_scoped_id: String(only.file_id),
            },
            game: gameId,
          });
          return;
        }

        if (files.length > 0) {
          setPickerFiles(files);
          setIsPickerOpen(true);
          tracker.trackFilePickerOpened({ mod_uid: mod.id, file_count: files.length, source });
        }
      },
    });
  };

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

  /**
   * 1-click install, which keeps showing its progress until its install is done. A free user with
   * an update sees it as 1-click update, and its upsell says update too.
   */
  const oneClick = () => (
    <Tooltip content={unavailable ?? filesError} disabled={!unavailable && !filesError}>
      <Button
        aria-disabled={!!unavailable}
        brand={isPremiumUser ? "primary" : "neutral"}
        disabled={isLoadingFile}
        isLoading={isInstalling || mainFiles.isPending}
        leftIcon="install_desktop"
        ref={mainButtonRef}
        rightIcon={isPremiumUser ? undefined : <PremiumBadge />}
        onClick={() => {
          if (unavailable) {
            return;
          }

          if (!isPremiumUser) {
            setUpsellFor("one-click");
            return;
          }

          if (choosesFile) {
            chooseFile("install");
            return;
          }

          if (mainFile && gameId) {
            install.mutate({ file: mainFile, game: gameId });
          }
        }}
      >
        {oneClickLabel}
      </Button>
    </Tooltip>
  );

  /**
   * What the user has of a mod with no primary file, as a split button whose menu opens the picker
   * on its Main files, after the Premium upsell for a free user. Picking from the menu leaves focus
   * on the main part, for the picker to return to; it spins while the files load.
   */
  const split = (label: string, onClick: () => void, look: "installed" | "downloaded") => (
    <SplitButton
      action={
        <Popover className="flex">
          <HeadlessPopoverButton
            as={SplitButtonAction}
            data-testid="mod-install-options"
            icon="keyboard_arrow_down"
            label={t("Install options")}
          />

          <PopoverPanel
            anchor={{ gap: 4, to: "bottom end" }}
            className="nxm-popover-panel-dropdown"
          >
            {({ close }) => (
              <PopoverMenu
                actions={[
                  [
                    {
                      label: t("View all main files"),
                      icon: "list",
                      testId: "mod-install-view-all-files",
                      onClick: () => {
                        if (!isPremiumUser) {
                          setUpsellFor("menu");
                          return;
                        }

                        chooseFile("menu");
                      },
                    },
                  ],
                ]}
                label={t("Install options")}
                onSelect={() => close(mainButtonRef)}
              />
            )}
          </PopoverPanel>
        </Popover>
      }
      brand={look === "installed" ? "neutral" : undefined}
      data-testid="mod-install-main"
      isLoading={mainFiles.isPending}
      leftIcon={look === "installed" ? { path: nxmModOutline } : "add"}
      ref={mainButtonRef}
      onClick={onClick}
    >
      {label}
    </SplitButton>
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
        <Button disabled isLoading leftIcon="add" ref={mainButtonRef}>
          {t("Install")}
        </Button>
      );
    }

    if (installState.kind === "installed" && !installState.update) {
      const modId = VortexModId(installState.mod.id);
      const viewInstalled = () => {
        tracker.trackViewInstalledClicked({ mod_uid: mod.id });
        showModOnModsPage(api, modId);
      };

      if (choosesFile && installState.installedCount > 1 && isPremiumUser) {
        return split(t("View installed mod"), () => chooseFile("install", true), "installed");
      }

      if (choosesFile) {
        return split(t("View installed mod"), viewInstalled, "installed");
      }

      return (
        <Button brand="neutral" leftIcon={{ path: nxmModOutline }} onClick={viewInstalled}>
          {t("View installed mod")}
        </Button>
      );
    }

    if (installState.kind === "installed" && isPremiumUser) {
      return (
        <Button
          brand="info"
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
      const { downloadId, downloadCount } = installState;
      const installDownload = () => {
        tracker.trackInstallClicked({ mod_uid: mod.id });
        api.events.emit("start-install-download", downloadId);
      };

      if (choosesFile && downloadCount > 1 && isPremiumUser) {
        return split(t("Install"), () => chooseFile("install", true), "downloaded");
      }

      if (choosesFile) {
        return split(t("Install"), installDownload, "downloaded");
      }

      return (
        <Button leftIcon="add" onClick={installDownload}>
          {t("Install")}
        </Button>
      );
    }

    return oneClick();
  };

  return (
    <>
      {control()}

      <MainFilePicker
        api={api}
        files={pickerFiles}
        isOpen={isPickerOpen}
        mod={mod}
        onClose={() => {
          setIsPickerOpen(false);
          mainButtonRef.current?.focus();
        }}
      />

      <PremiumUpsellModal
        {...upsellText}
        api={api}
        content={Content.BrowseModsAd}
        fallbackIcon="open_in_new"
        isOpen={!!upsellFor}
        onClose={() => setUpsellFor(undefined)}
        onDismissed={() =>
          tracker.trackPremiumModalDismissed({ mod_uid: mod.id, action: upsellAction })
        }
        onFallback={() => {
          tracker.trackPremiumModalFallbackClicked({ mod_uid: mod.id, action: upsellAction });
          setUpsellFor(undefined);

          window.api.shell.openUrl(nexusModFilesUrl(domain, mod.game_scoped_id));
        }}
        onPremiumUnlocked={() => {
          if (upsellFor === "menu") {
            chooseFile("menu");
            return;
          }

          if (installState.kind === "installed") {
            runUpdate();
            return;
          }

          if (choosesFile) {
            chooseFile("install");
            return;
          }

          if (mainFile && gameId) {
            install.mutate({ file: mainFile, game: gameId });
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

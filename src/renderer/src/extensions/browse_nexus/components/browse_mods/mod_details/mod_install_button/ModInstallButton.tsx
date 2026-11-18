import type { IFileInfo } from "@nexusmods/nexus-api";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { VortexGameId, VortexModId } from "@vortex/shared";
import type { TFunction } from "i18next";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { MainFilePicker } from "@/extensions/browse_nexus/components/browse_mods/mod_details/main_file_picker/MainFilePicker";
import {
  type IModOptionsSplitLook,
  ModOptionsSplitButton,
} from "@/extensions/browse_nexus/components/browse_mods/mod_details/mod_install_button/mod_options_split_button/ModOptionsSplitButton";
import type { FilePickerSource } from "@/extensions/browse_nexus/hooks/browse_mods_tracking/browseModsTracker";
import { useBrowseModsTracker } from "@/extensions/browse_nexus/hooks/browse_mods_tracking/BrowseModsTracking.context";
import { useDeleteModFiles } from "@/extensions/browse_nexus/hooks/use_delete_mod_files/useDeleteModFiles.hook";
import { useModUpsell } from "@/extensions/browse_nexus/hooks/use_mod_upsell/useModUpsell.hook";
import { fileUidOf } from "@/extensions/browse_nexus/util/file_uid/fileUid";
import {
  installNexusFile,
  installsWhenDownloaded,
  reportInstallFailure,
} from "@/extensions/browse_nexus/util/install_nexus_file/installNexusFile";
import { mainFilesOf } from "@/extensions/browse_nexus/util/main_files/mainFiles";
import type { ModInstallState } from "@/extensions/browse_nexus/util/mod_install_state/modInstallState";
import {
  oneClickFileInstallsKey,
  oneClickInstallKey,
} from "@/extensions/browse_nexus/util/one_click_install/oneClickInstall";
import { showModOnModsPage } from "@/extensions/mod_management/util/show_mod_on_mods_page/showModOnModsPage";
import { updateMod } from "@/extensions/mod_management/util/update_mod/updateMod";
import type { ModMainFileVersion } from "@/extensions/nexus_integration/queries/mod/mod.query";
import { modFilesQuery } from "@/extensions/nexus_integration/queries/mod_files/modFiles.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { isPremium } from "@/extensions/nexus_integration/selectors";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { PremiumBadge } from "@/ui/components/badges/premium_badge/PremiumBadge";
import { Button } from "@/ui/components/button/Button";
import type { IMenuAction } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { nxmModOutline } from "@/ui/icon-paths";
import { activeGameId } from "@/util/selectors";

/** The files the picker opens on: the mod's Main files, and all of its files. */
interface IPickerFiles {
  /** Its Main files, which get cards. */
  main: IFileInfo[];
  /** All of its files, for which the user's other files are. */
  all: IFileInfo[];
}

const NO_PICKER_FILES: IPickerFiles = { main: [], all: [] };

/** The file 1-click installs: its UID, for tracking, and its id within the mod. */
type InstallFile = Pick<ModMainFileVersion, "id" | "game_scoped_id">;

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

interface IModInstallButtonProps {
  api: IExtensionApi;
  /** The mod to download, and install. */
  mod: ModSummary;
  /** Its file from v3: not primary to choose, null when it has none, absent while loading. */
  mainFile?: ModMainFileVersion | null;
  /** Whether its details failed to load, so whether it has a main file isn't known. */
  isError?: boolean;
  /** What the user has of it, from `useModStatus`. */
  installState: ModInstallState;
}

/**
 * The details' button for what the user has of a mod: Manage mod once it's installed,
 * Update while the Mods page's update check offers one, Install for a download, and otherwise
 * 1-click install of its main file, which only downloads if the user's settings don't install
 * once downloaded. Non-Premium users get the 1-click upsell for an update as for an install, its
 * events saying which. Progress survives switching mods.
 *
 * A mod with several Main files and no primary has them fetched on click, for the picker; with
 * one, it's installed as a primary is. v3 giving it no file at all means it isn't available
 * through Vortex. Once the user has a mod, its button splits, its menu uninstalling or deleting it
 * and, for a mod with several Main files and no primary, reaching the picker again; with several
 * of those files downloaded or installed, a Premium user's main action opens the picker too. It spins while any
 * of the mod's files is uninstalling, so nothing is started on them twice.
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
  const queryClient = useQueryClient();
  const [pickerFiles, setPickerFiles] = useState<IPickerFiles>(NO_PICKER_FILES);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const mainButtonRef = useRef<HTMLButtonElement>(null);
  const {
    uninstallAction,
    deleteAction,
    modal: deleteModal,
    isDeleting,
  } = useDeleteModFiles(api, mod, mainButtonRef);
  const installKey = oneClickInstallKey(mod.id);
  const isOneClicking = useIsMutating({ mutationKey: installKey }) > 0;
  const isCardInstalling = useIsMutating({ mutationKey: oneClickFileInstallsKey(mod.id) }) > 0;
  const isInstalling = isOneClicking || isCardInstalling;
  const action = shouldInstall ? "install" : "download";
  const hasUpdate = installState.kind === "installed" && !!installState.update;
  const isLoadingFile = !hasUpdate && mainFile === undefined && !isError;
  /** v3 gives a mod with no primary its newest Main file; `count` says if there are others. */
  const choosesFile = mainFile?.is_primary === false && mainFile.count > 1;

  const install = useMutation({
    mutationKey: installKey,
    mutationFn: ({ file, gameId }: { file: InstallFile; gameId: VortexGameId }) =>
      installNexusFile(api, {
        mod,
        fileId: file.game_scoped_id,
        gameId,
        shouldInstall,
      }),
    onMutate: ({ file }) =>
      tracker.trackOneClickClicked({ mod_uid: mod.id, file_uid: file.id, action }),
    onError: (error) => reportInstallFailure(api, { t, mod, shouldInstall, error }),
  });

  /** A read, but a mutation so it runs only on click and its pending and error state show. */
  const loadModFiles = useMutation({
    mutationFn: () => queryClient.fetchQuery(modFilesQuery(api, { mod })),
  });
  const hasNoFiles =
    mainFile === null || (!!loadModFiles.data && mainFilesOf(loadModFiles.data).length === 0);
  const unavailable = unavailableReason(t, isError, hasNoFiles, hasUpdate);
  const filesError = loadModFiles.isError ? t("Couldn't load this mod's files") : undefined;

  /**
   * Fetches the mod's Main files, then opens the picker on them, or installs the only one if v3's
   * count was out of date. From
   * the split button the picker opens on any, and a failure or no files is said in a notification.
   * `source` is what the picker's opening is tracked as.
   */
  const chooseFile = (source: FilePickerSource) => {
    const fromSplit = source !== "one_click";

    if (!gameId) {
      return;
    }

    loadModFiles.mutate(undefined, {
      onError: (error) => {
        if (fromSplit) {
          api.showErrorNotification(t("Couldn't load this mod's files"), error, {
            allowReport: false,
          });
        }
      },
      onSuccess: (all) => {
        const files = mainFilesOf(all);
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
              id: fileUidOf(mod, only.file_id),
              game_scoped_id: String(only.file_id),
            },
            gameId,
          });
          return;
        }

        if (files.length > 0) {
          setPickerFiles({ main: files, all });
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

  const {
    oneClickLabel,
    open: openUpsell,
    modal: upsellModal,
  } = useModUpsell(api, mod, {
    hasUpdate,
    action,
    onUnlocked: (source) => {
      if (source === "menu") {
        chooseFile("split_menu");
        return;
      }

      if (installState.kind === "installed") {
        runUpdate();
        return;
      }

      if (choosesFile) {
        chooseFile("one_click");
        return;
      }

      if (mainFile && gameId) {
        install.mutate({ file: mainFile, gameId });
      }
    },
  });

  /**
   * 1-click install, which keeps showing its progress until its install is done. A free user with
   * an update sees it as 1-click update, and its upsell says update too.
   */
  const oneClick = () => (
    <Tooltip content={unavailable ?? filesError} disabled={!unavailable && !filesError}>
      <Button
        aria-disabled={!!unavailable}
        brand={isPremiumUser ? "primary" : "neutral"}
        data-testid="mod-install-one-click"
        disabled={isLoadingFile}
        isLoading={isInstalling || loadModFiles.isPending}
        leftIcon="install_desktop"
        ref={mainButtonRef}
        rightIcon={isPremiumUser ? undefined : <PremiumBadge />}
        onClick={() => {
          if (unavailable) {
            return;
          }

          if (!isPremiumUser) {
            openUpsell("one-click");
            return;
          }

          if (choosesFile) {
            chooseFile("one_click");
            return;
          }

          if (mainFile && gameId) {
            install.mutate({ file: mainFile, gameId });
          }
        }}
      >
        {oneClickLabel}
      </Button>
    </Tooltip>
  );

  /** View all main files, for a mod with several and no primary, after the upsell for a free user. */
  const viewAllFiles: IMenuAction = {
    label: t("View all main files"),
    icon: "list",
    testId: "mod-install-view-all-files",
    onClick: () => {
      if (!isPremiumUser) {
        openUpsell("menu");
        return;
      }

      chooseFile("split_menu");
    },
  };

  /**
   * The split button for what the user has, its menu reaching the picker, and uninstalling or
   * deleting it; a mod that's only downloaded has nothing to uninstall.
   */
  const split = (look: IModOptionsSplitLook, onClick: () => void) => {
    const removeActions =
      installState.kind === "installed" ? [uninstallAction, deleteAction] : [deleteAction];

    return (
      <ModOptionsSplitButton
        {...look}
        actions={choosesFile ? [[viewAllFiles], removeActions] : [removeActions]}
        isLoading={loadModFiles.isPending || isDeleting}
        mainRef={mainButtonRef}
        onClick={onClick}
      />
    );
  };

  /**
   * The button for what the user has of the mod; the upsell beside it stays put as it changes.
   * 1-click install holds while it runs, as between its download finishing and its install
   * starting the mod reads as downloaded; a picker card's 1-click install of one of its files
   * holds it alike.
   */
  const control = () => {
    if (isInstalling) {
      return oneClick();
    }

    if (installState.kind === "installing") {
      return (
        <Button
          disabled
          isLoading
          data-testid="mod-install-install"
          leftIcon="add"
          ref={mainButtonRef}
        >
          {t("Install")}
        </Button>
      );
    }

    if (installState.kind === "installed" && !installState.update) {
      const modId = VortexModId(installState.mod.id);
      const look: IModOptionsSplitLook = {
        label: t("Manage mod"),
        brand: "neutral",
        leftIcon: { path: nxmModOutline },
        testId: "mod-install-view-installed",
      };

      if (choosesFile && installState.installedCount > 1 && isPremiumUser) {
        return split(look, () => chooseFile("split_button"));
      }

      return split(look, () => {
        tracker.trackViewInstalledClicked({ mod_uid: mod.id });
        showModOnModsPage(api, modId);
      });
    }

    if (installState.kind === "installed" && isPremiumUser) {
      const look: IModOptionsSplitLook = {
        label: t("Update"),
        brand: "info",
        leftIcon: "download",
        testId: "mod-install-update",
      };

      return split(look, () => {
        tracker.trackUpdateClicked({ mod_uid: mod.id });
        runUpdate();
      });
    }

    if (installState.kind === "installed") {
      const look: IModOptionsSplitLook = {
        label: oneClickLabel,
        brand: "neutral",
        leftIcon: "install_desktop",
        rightIcon: <PremiumBadge />,
        testId: "mod-install-one-click",
      };

      return split(look, () => openUpsell("one-click"));
    }

    if (installState.kind === "downloaded") {
      const { downloadId, downloadCount } = installState;
      const look: IModOptionsSplitLook = {
        label: t("Install"),
        leftIcon: "add",
        testId: "mod-install-install",
      };

      if (choosesFile && downloadCount > 1 && isPremiumUser) {
        return split(look, () => chooseFile("split_button"));
      }

      return split(look, () => {
        tracker.trackInstallClicked({ mod_uid: mod.id });
        api.events.emit("start-install-download", downloadId);
      });
    }

    return oneClick();
  };

  return (
    <>
      {control()}

      <MainFilePicker
        api={api}
        files={pickerFiles.main}
        isOpen={isPickerOpen}
        mod={mod}
        modFiles={pickerFiles.all}
        onClose={() => {
          setIsPickerOpen(false);
          mainButtonRef.current?.focus();
        }}
      />

      {deleteModal}

      {upsellModal}
    </>
  );
};

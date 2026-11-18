import { useIsMutating, useMutation } from "@tanstack/react-query";
import { NexusGameDomain } from "@vortex/shared";
import React, { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { DeleteModFilesModal } from "@/extensions/browse_nexus/components/browse_mods/mod_details/delete_mod_files_modal/DeleteModFilesModal";
import type { RemoveMenuOption } from "@/extensions/browse_nexus/hooks/browse_mods_tracking/browseModsTracker";
import { useBrowseModsTracker } from "@/extensions/browse_nexus/hooks/browse_mods_tracking/BrowseModsTracking.context";
import {
  deleteModFiles,
  isUninstallingIn,
  type OwnedModFile,
  ownedModFilesIn,
  removalCounts,
} from "@/extensions/browse_nexus/util/delete_mod_files/deleteModFiles";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import type { IMenuAction } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { activeGameId } from "@/util/selectors";

/** The key of a delete of a mod's files from Browse, which outlasts its details being shown. */
export const deleteModFilesKey = (modId: string) => ["browse", "delete-files", modId];

/**
 * Removing a mod from Browse: the menu's Uninstall and Delete, which open the modal on the files
 * the user has of it with "Also delete downloaded files" unticked or ticked, the `modal` for the
 * caller to render once, and whether its files are being removed, from here until every removal
 * has finished, or uninstalled from the Mods page. A removal runs as a mutation keyed to the mod,
 * so it still shows after switching mods and back. Picking either, and confirming or cancelling
 * the modal, are each tracked. Closing the modal returns focus to `returnFocus`, and so does the
 * end of a removal that left focus on the page.
 */
export const useDeleteModFiles = (
  api: IExtensionApi,
  mod: ModSummary,
  returnFocus: RefObject<HTMLElement | null>,
): {
  uninstallAction: IMenuAction;
  deleteAction: IMenuAction;
  modal: ReactNode;
  isDeleting: boolean;
} => {
  const { t } = useTranslation();
  const tracker = useBrowseModsTracker();
  const gameId = useSelector(activeGameId);
  const ref = { domain: NexusGameDomain(mod.game.domain_name), modId: Number(mod.game_scoped_id) };
  const isUninstalling = useSelector((state: IState) => isUninstallingIn(state, ref));
  const [files, setFiles] = useState<OwnedModFile[]>();
  const [menuOption, setMenuOption] = useState<RemoveMenuOption>("uninstall");
  const removeFiles = useMutation({
    mutationKey: deleteModFilesKey(mod.id),
    mutationFn: ({
      chosen,
      deleteDownloads,
    }: {
      chosen: OwnedModFile[];
      deleteDownloads: boolean;
    }) => deleteModFiles(api, gameId, chosen, { deleteArchives: deleteDownloads }),
  });
  const isRunning = useIsMutating({ mutationKey: deleteModFilesKey(mod.id) }) > 0;
  const isDeleting = isUninstalling || isRunning;
  const shouldRestoreFocus = useRef(false);

  /**
   * Once a delete is over, returns focus to the button if it fell to the page: the button is
   * disabled while it spins, and may be replaced as what the user has of the mod changes.
   */
  useEffect(() => {
    if (!shouldRestoreFocus.current || isDeleting) {
      return;
    }

    shouldRestoreFocus.current = false;

    if (!document.activeElement || document.activeElement === document.body) {
      returnFocus.current?.focus();
    }
  });

  /** Opens the modal on the user's files, its downloads option preset by the option picked. */
  const open = (option: RemoveMenuOption) => {
    const owned = ownedModFilesIn(api.getState(), ref);
    tracker.trackRemoveClicked({ mod_uid: mod.id, file_count: owned.length, menu_option: option });

    if (owned.length === 0) {
      api.sendNotification({
        type: "info",
        message: t("There are no files of this mod for Vortex to remove."),
      });
      return;
    }

    setMenuOption(option);
    setFiles(owned);
  };

  const uninstallAction: IMenuAction = {
    label: t("Uninstall"),
    icon: "do_not_disturb_on",
    testId: "mod-install-uninstall",
    onClick: () => open("uninstall"),
  };

  const deleteAction: IMenuAction = {
    label: t("Delete"),
    icon: "delete",
    brand: "danger",
    testId: "mod-install-delete",
    onClick: () => open("delete"),
  };

  const modal = (
    <DeleteModFilesModal
      deletesDownloads={menuOption === "delete"}
      files={files}
      modName={mod.name}
      onClose={() => {
        tracker.trackRemoveCancelled({
          mod_uid: mod.id,
          file_count: files?.length ?? 0,
          menu_option: menuOption,
        });
        setFiles(undefined);
        returnFocus.current?.focus();
      }}
      onDelete={(chosen, deleteDownloads) => {
        const { deleted, uninstalled } = removalCounts(chosen, deleteDownloads);
        tracker.trackRemoveConfirmed({
          mod_uid: mod.id,
          menu_option: menuOption,
          deleted_count: deleted,
          uninstalled_count: uninstalled,
          deletes_downloads: deleteDownloads,
        });
        setFiles(undefined);
        shouldRestoreFocus.current = true;
        removeFiles.mutate({ chosen, deleteDownloads });
      }}
    />
  );

  return { uninstallAction, deleteAction, modal, isDeleting };
};

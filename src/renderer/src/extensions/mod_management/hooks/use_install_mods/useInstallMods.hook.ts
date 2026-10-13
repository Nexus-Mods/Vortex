import { parseError } from "@vortex/shared";
import { useCallback } from "react";

import { startActivity, stopActivity } from "@/actions/session";
import { useMainContext } from "@/contexts";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { withBatchContext } from "@/util/BatchContext";

/**
 * Why an archive can't be installed yet, or undefined if it can. Checked here, as the install
 * handler checks it too but, given a callback, only passes it on, and for a download without
 * a path never calls back at all, which would leave the row loading.
 */
const notInstallable = (api: IExtensionApi, archiveId: string): string | undefined => {
  const download = api.getState().persistent.downloads.files[archiveId];

  if (download === undefined) {
    return "Vortex no longer knows about this archive, so it can't be installed.";
  }
  if (download.state !== "finished") {
    return "The download must finish before it can be installed.";
  }
  if (!download.localPath) {
    return "The download's details are incomplete. Refresh your downloads, then try again.";
  }

  return undefined;
};

/** Installs an archive, resolving with the mod it installed, or null if it didn't. */
const installArchive = async (api: IExtensionApi, archiveId: string) => {
  const reason = notInstallable(api, archiveId);
  if (reason !== undefined) {
    api.showErrorNotification("Failed to install mod", reason, { allowReport: false });
    return null;
  }

  try {
    return await new Promise<string>((resolve, reject) =>
      api.events.emit(
        "start-install-download",
        archiveId,
        { allowAutoEnable: false },
        (err: Error | null, modId: string) => (err ? reject(err) : resolve(modId)),
      ),
    );
  } catch (err) {
    // The handler passes on what stops it starting, such as a locked file, rather than saying
    // so; a cancel is the user's choice, and the install reports its own failures.
    if (parseError(err).data.kind === "data-invalid") {
      api.showErrorNotification("Failed to install mod", err, { allowReport: false });
    }
    return null;
  }
};

/**
 * The activity group each archive being installed is listed in, by id, for its row to show it
 * from the click on, through any installer dialog. A group of its own, as uninstalling has.
 */
export const INSTALLING_ACTIVITY = "mods-installing";

/**
 * Installs the given archives, then enables what they installed if the user has Vortex
 * enable mods when installed: the legacy table's Install, for the archives it's asked about.
 *
 * @param onEnable Enables mods by id, as the table's switches do.
 */
export const useInstallMods = (onEnable: (modIds: string[]) => void) => {
  const { api } = useMainContext();

  return useCallback(
    (archiveIds: string[]) =>
      withBatchContext("install-mod", archiveIds, async () => {
        const modIds = await Promise.all(
          archiveIds.map(async (archiveId) => {
            api.store?.dispatch(startActivity(INSTALLING_ACTIVITY, archiveId));
            try {
              return await installArchive(api, archiveId);
            } finally {
              api.store?.dispatch(stopActivity(INSTALLING_ACTIVITY, archiveId));
            }
          }),
        );

        const installed = modIds.filter((modId): modId is string => !!modId);
        if (api.getState().settings.automation?.enable && installed.length > 0) {
          onEnable(installed);
        }
      }),
    [api, onEnable],
  );
};

import { useCallback } from "react";

import { startActivity, stopActivity } from "@/actions/session";
import { useMainContext } from "@/contexts";
import { withBatchContext } from "@/util/BatchContext";
import { toPromise } from "@/util/util";

/**
 * The activity group each archive being installed is listed in, by id, for its row to show it
 * from the click on, through any installer dialog. A group of its own, as uninstalling has.
 */
export const INSTALLING_ACTIVITY = "mods-installing";

/**
 * Installs the given archives, then enables what they installed if the user has Vortex do
 * that: the legacy table's Install, for the archives it's asked about.
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
              return await toPromise<string>((cb) =>
                api.events.emit(
                  "start-install-download",
                  archiveId,
                  { allowAutoEnable: false },
                  cb,
                ),
              );
            } catch {
              // a cancel is the user's choice, and the install reports its own failures
              return null;
            } finally {
              api.store?.dispatch(stopActivity(INSTALLING_ACTIVITY, archiveId));
            }
          }),
        );

        const installed = modIds.filter((modId): modId is string => !!modId);
        if (api.getState().settings.automation?.install && installed.length > 0) {
          onEnable(installed);
        }
      }),
    [api, onEnable],
  );
};

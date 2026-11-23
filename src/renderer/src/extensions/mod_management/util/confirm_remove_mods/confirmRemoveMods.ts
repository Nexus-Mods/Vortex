import type { VortexGameId } from "@vortex/shared";

import { startActivity, stopActivity } from "@/actions/session";
import type { ICheckbox } from "@/types/IDialog";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { toPromise } from "@/util/util";

import modName from "../modName";
import { removeMods } from "../removeMods";
import { reportRemovalFailure, UNINSTALLING_ACTIVITY } from "../uninstall_mods/uninstallMods";

/**
 * The activity group each mod being removed is listed in, by id, for its row to show it.
 * A group of its own: anything in "mods" reads as the whole app being busy.
 */
export const REMOVING_ACTIVITY = "mods-removing";

/** Whether a mod is being removed or uninstalled, so no other removal should start on it. */
export const isRowBusy = (state: IState, modId: string): boolean => {
  const activity = state.session?.base?.activity;
  return (
    !!activity?.[REMOVING_ACTIVITY]?.includes(modId) ||
    !!activity?.[UNINSTALLING_ACTIVITY]?.includes(modId)
  );
};

/**
 * The mods Remove can start on now: installed ones, and archives only downloaded, whose row
 * has the archive's id. One already being removed or uninstalled is left out.
 */
export const removableMods = (state: IState, gameId: VortexGameId, modIds: string[]): string[] => {
  const installed = state.persistent.mods?.[gameId] ?? {};
  const downloads = state.persistent.downloads?.files ?? {};
  return modIds.filter(
    (modId) =>
      !isRowBusy(state, modId) &&
      (installed[modId] !== undefined || downloads[modId]?.state === "finished"),
  );
};

const removeDownload = (api: IExtensionApi, downloadId: string): Promise<void> =>
  Promise.resolve(
    toPromise<void>((cb) =>
      api.events.emit("remove-download", downloadId, cb, { confirmed: true }),
    ),
  );

/**
 * Removes mods from a game once the user confirms, as the classic table's Remove asks: the
 * mods, their archives, or both. Lists each as removing from confirmation until it's done, so
 * its row shows it and no second removal starts on it. Never rejects: resolves to whether it
 * finished.
 */
export const confirmRemoveMods = async (
  api: IExtensionApi,
  gameId: VortexGameId,
  modIds: string[],
): Promise<boolean> => {
  const t = api.translate;
  const asked = removableMods(api.getState(), gameId, modIds);
  if (asked.length === 0) {
    return false;
  }

  const installed = api.getState().persistent.mods?.[gameId] ?? {};
  const downloads = api.getState().persistent.downloads?.files ?? {};

  const names = asked.map((modId) =>
    installed[modId] !== undefined
      ? modName(installed[modId], { version: true, variant: true })
      : `${downloads[modId]?.localPath ?? modId} ${t("(Archive only)")}`,
  );

  const archivesOnly = asked.every((modId) => installed[modId] === undefined);
  const checkboxes: ICheckbox[] = archivesOnly
    ? [{ id: "archive", text: t("Delete Archive"), value: true }]
    : [
        { id: "mod", text: t("Remove Mod"), value: true },
        { id: "archive", text: t("Delete Archive"), value: false },
      ];

  const insert = " [style=dialog-danger-text]" + t("from all profiles") + "[/style]";

  const result = await api.showDialog?.(
    "question",
    "Confirm removal",
    {
      bbcode: t("Do you really want to remove this mod{{insert}}?", {
        count: asked.length,
        replace: { insert },
      }),
      message: names.join("\n"),
      checkboxes,
    },
    [{ label: "Cancel" }, { label: "Remove" }],
  );

  if (result?.action !== "Remove") {
    return false;
  }

  // Another removal may have started on some while the dialog was open.
  const confirmed = removableMods(api.getState(), gameId, asked);
  if (confirmed.length === 0) {
    return false;
  }

  const installedIds = confirmed.filter((modId) => installed[modId] !== undefined);
  const archiveIds = confirmed
    .map((modId) => (installed[modId] !== undefined ? installed[modId].archiveId : modId))
    .filter((archiveId): archiveId is string => archiveId !== undefined);

  confirmed.forEach((modId) => api.store?.dispatch(startActivity(REMOVING_ACTIVITY, modId)));

  try {
    if (result.input?.mod) {
      await removeMods(api, gameId, installedIds);
    }
    if (result.input?.archive) {
      await Promise.all(archiveIds.map((archiveId) => removeDownload(api, archiveId)));
    }
    return true;
  } catch (err) {
    reportRemovalFailure(api, "Failed to remove mods", err);
    return false;
  } finally {
    confirmed.forEach((modId) => api.store?.dispatch(stopActivity(REMOVING_ACTIVITY, modId)));
  }
};

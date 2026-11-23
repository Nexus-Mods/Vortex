import type { VortexGameId } from "@vortex/shared";

import { startActivity, stopActivity } from "@/actions/session";
import type { ICheckbox, IDialogResult } from "@/types/IDialog";
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

/** The game's installed mods, by id. */
const installedMods = (state: IState, gameId: VortexGameId) =>
  state.persistent.mods?.[gameId] ?? {};

/**
 * The mods Remove can start on now: installed ones, and archives only downloaded, whose row
 * has the archive's id. One still installing, or already being removed or uninstalled, is left
 * out, as the classic table offered Remove only once a mod was installed.
 */
export const removableMods = (state: IState, gameId: VortexGameId, modIds: string[]): string[] => {
  const installed = installedMods(state, gameId);
  const downloads = state.persistent.downloads?.files ?? {};
  return modIds.filter((modId) => {
    if (isRowBusy(state, modId)) {
      return false;
    }
    const mod = installed[modId];
    return mod !== undefined ? mod.state !== "installing" : downloads[modId]?.state === "finished";
  });
};

const removeDownload = (api: IExtensionApi, downloadId: string): Promise<void> =>
  Promise.resolve(
    toPromise<void>((cb) =>
      api.events.emit("remove-download", downloadId, cb, { confirmed: true }),
    ),
  );

/**
 * Deletes the archives, waiting for every one, so none is still going once its rows stop
 * showing as removing. Reports each that couldn't be deleted; resolves to whether all were.
 */
const deleteArchives = async (api: IExtensionApi, archiveIds: string[]): Promise<boolean> => {
  const results = await Promise.allSettled(
    archiveIds.map((archiveId) => removeDownload(api, archiveId)),
  );
  const failures = results.filter((result) => result.status === "rejected");
  failures.forEach((failure) =>
    reportRemovalFailure(api, "Failed to delete archive", failure.reason),
  );
  return failures.length === 0;
};

/** Asks, as the classic table's Remove does, whether to remove the mods, their archives or both. */
const askToRemove = (
  api: IExtensionApi,
  gameId: VortexGameId,
  modIds: string[],
): Promise<IDialogResult | undefined> => {
  const t = api.translate;
  const state = api.getState();
  const installed = installedMods(state, gameId);
  const downloads = state.persistent.downloads?.files ?? {};

  const names = modIds.map((modId) =>
    installed[modId] !== undefined
      ? modName(installed[modId], { version: true, variant: true })
      : `${downloads[modId]?.localPath ?? modId} ${t("(Archive only)")}`,
  );

  const archivesOnly = modIds.every((modId) => installed[modId] === undefined);
  const checkboxes: ICheckbox[] = archivesOnly
    ? [{ id: "archive", text: t("Delete Archive"), value: true }]
    : [
        { id: "mod", text: t("Remove Mod"), value: true },
        { id: "archive", text: t("Delete Archive"), value: false },
      ];

  const insert = " [style=dialog-danger-text]" + t("from all profiles") + "[/style]";

  return Promise.resolve(
    api.showDialog?.(
      "question",
      "Confirm removal",
      {
        bbcode: t("Do you really want to remove this mod{{insert}}?", {
          count: modIds.length,
          replace: { insert },
        }),
        message: names.join("\n"),
        checkboxes,
      },
      [{ label: "Cancel" }, { label: "Remove" }],
    ),
  );
};

/** The installed mods among these, and the archives they and any archive-only rows come from. */
const removalTargets = (state: IState, gameId: VortexGameId, modIds: string[]) => {
  const installed = installedMods(state, gameId);
  return {
    installedIds: modIds.filter((modId) => installed[modId] !== undefined),
    archiveIds: modIds
      .map((modId) => (installed[modId] !== undefined ? installed[modId].archiveId : modId))
      .filter((archiveId): archiveId is string => archiveId !== undefined),
  };
};

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
  const asked = removableMods(api.getState(), gameId, modIds);
  if (asked.length === 0) {
    return false;
  }

  const result = await askToRemove(api, gameId, asked);
  if (result?.action !== "Remove") {
    return false;
  }

  // Read again once confirmed: another removal may have started on some while the dialog was open.
  const state = api.getState();
  const confirmed = removableMods(state, gameId, asked);
  if (confirmed.length === 0) {
    return false;
  }
  const { installedIds, archiveIds } = removalTargets(state, gameId, confirmed);

  confirmed.forEach((modId) => api.store?.dispatch(startActivity(REMOVING_ACTIVITY, modId)));

  try {
    if (result.input?.mod) {
      try {
        await removeMods(api, gameId, installedIds);
      } catch (err) {
        // The archives stay, as a mod that's still there may need them.
        reportRemovalFailure(api, "Failed to remove mods", err);
        return false;
      }
    }
    return result.input?.archive ? await deleteArchives(api, archiveIds) : true;
  } finally {
    confirmed.forEach((modId) => api.store?.dispatch(stopActivity(REMOVING_ACTIVITY, modId)));
  }
};

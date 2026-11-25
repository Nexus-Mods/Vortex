import type { VortexGameId } from "@vortex/shared";

import { startActivity, stopActivity } from "@/actions/session";
import type { ICheckbox, IDialogResult } from "@/types/IDialog";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { batchDispatch, toPromise } from "@/util/util";

import { modsForGame } from "../../selectors";
import filterModInfo from "../filterModInfo";
import modName, { modNameFromAttributes } from "../modName";
import { removeMods } from "../removeMods";
import { reportRemovalFailure } from "../report_removal_failure/reportRemovalFailure";
import { UNINSTALLING_ACTIVITY } from "../uninstall_mods/uninstallMods";

/**
 * The activity group each mod being removed is listed in, by id, for its row to show it.
 * A group of its own: anything in "mods" reads as the whole app being busy.
 */
export const REMOVING_ACTIVITY = "mods-removing";

/** Whether a mod is being removed or uninstalled, so no other removal should start on it. */
export const isBeingRemoved = (state: IState, modId: string): boolean => {
  const activity = state.session?.base?.activity;
  return (
    !!activity?.[REMOVING_ACTIVITY]?.includes(modId) ||
    !!activity?.[UNINSTALLING_ACTIVITY]?.includes(modId)
  );
};

/**
 * The mods Remove can start on now: installed ones, and archives only downloaded, whose row
 * has the archive's id. One still installing, or already being removed or uninstalled, is left
 * out, as the classic table offered Remove only once a mod was installed.
 */
export const removableMods = (state: IState, gameId: VortexGameId, modIds: string[]): string[] => {
  const installed = modsForGame(state, gameId);
  const downloads = state.persistent.downloads?.files ?? {};
  return modIds.filter((modId) => {
    if (isBeingRemoved(state, modId)) {
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

const NAME_OPTIONS = { version: true, variant: true };

/** An archive-only row's name, from what the archive says of its mod, as its row has it. */
const archiveName = async (state: IState, archiveId: string): Promise<string> => {
  const download = state.persistent.downloads?.files?.[archiveId];
  if (download === undefined) {
    return archiveId;
  }
  const info = await filterModInfo({ download, meta: download.modInfo?.meta }, undefined);
  return modNameFromAttributes(info, NAME_OPTIONS);
};

/** Asks, as the classic table's Remove does, whether to remove the mods, their archives or both. */
const askToRemove = async (
  api: IExtensionApi,
  gameId: VortexGameId,
  modIds: string[],
): Promise<IDialogResult | undefined> => {
  const t = api.translate;
  const state = api.getState();
  const installed = modsForGame(state, gameId);

  const names = await Promise.all(
    modIds.map(async (modId) =>
      installed[modId] !== undefined
        ? modName(installed[modId], NAME_OPTIONS)
        : `${await archiveName(state, modId)} ${t("(Archive only)")}`,
    ),
  );

  const archivesOnly = modIds.every((modId) => installed[modId] === undefined);
  const checkboxes: ICheckbox[] = archivesOnly
    ? [{ id: "archive", text: t("Delete Archive"), value: true }]
    : [
        { id: "mod", text: t("Remove Mod"), value: true },
        { id: "archive", text: t("Delete Archive"), value: false },
      ];

  const insert = " [style=dialog-danger-text]" + t("from all profiles") + "[/style]";

  return api.showDialog?.(
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
  );
};

/**
 * The rows the chosen options do something to: an installed mod if it's removed, or its archive
 * deleted, and an archive-only row if archives are deleted. Any other is left as it was, so it
 * isn't shown as removing.
 */
const touchedBy = (
  state: IState,
  gameId: VortexGameId,
  modIds: string[],
  input: { mod?: boolean; archive?: boolean } | undefined,
): string[] => {
  const installed = modsForGame(state, gameId);
  return modIds.filter((modId) =>
    installed[modId] !== undefined
      ? !!input?.mod || (!!input?.archive && installed[modId].archiveId !== undefined)
      : !!input?.archive,
  );
};

/** The installed mods among these, and the archives they and any archive-only rows come from. */
const removalTargets = (state: IState, gameId: VortexGameId, modIds: string[]) => {
  const installed = modsForGame(state, gameId);
  return {
    installedIds: modIds.filter((modId) => installed[modId] !== undefined),
    archiveIds: modIds
      .map((modId) => (installed[modId] !== undefined ? installed[modId].archiveId : modId))
      .filter((archiveId): archiveId is string => archiveId !== undefined),
  };
};

/**
 * Removes mods from a game once the user confirms, as the classic table's Remove asks: the
 * mods, their archives, or both. Lists each, and each archive it deletes, as removing from
 * confirmation until it's done, so its row shows it and no second removal starts on it. Never
 * rejects: resolves to whether it finished.
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

  let result: IDialogResult | undefined;
  try {
    result = await askToRemove(api, gameId, asked);
  } catch (err) {
    reportRemovalFailure(api, "Failed to remove mods", err);
    return false;
  }
  if (result?.action !== "Remove") {
    return false;
  }

  // Read again once confirmed: another removal may have started on some while the dialog was open.
  const state = api.getState();
  const confirmed = touchedBy(state, gameId, removableMods(state, gameId, asked), result.input);
  if (confirmed.length === 0) {
    return false;
  }
  const { installedIds, archiveIds } = removalTargets(state, gameId, confirmed);

  // The archives being deleted too: once a mod is gone, the list shows its archive in a row of
  // its own, by the archive's id, until the archive is deleted as well.
  const listed = [...new Set([...confirmed, ...(result.input?.archive ? archiveIds : [])])];

  // In one batch each way, so the rows work out whether they're busy once, not once per mod.
  const listAsRemoving = (action: typeof startActivity) => {
    if (api.store !== undefined) {
      batchDispatch(
        api.store,
        listed.map((id) => action(REMOVING_ACTIVITY, id)),
      );
    }
  };

  listAsRemoving(startActivity);

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
    listAsRemoving(stopActivity);
  }
};

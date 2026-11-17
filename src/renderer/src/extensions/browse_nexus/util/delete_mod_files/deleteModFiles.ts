import type { VortexGameId } from "@vortex/shared";

import {
  gameDomains,
  modInstallGroups,
} from "@/extensions/browse_nexus/hooks/use_mod_install_state/modInstallSelectors";
import {
  type INexusModRef,
  modKey,
} from "@/extensions/browse_nexus/util/mod_install_state/modInstallState";
import {
  type IUserModFileSources,
  storedNameOf,
  userModFilesOf,
} from "@/extensions/browse_nexus/util/user_mod_files/userModFiles";
import type { IMod } from "@/extensions/mod_management/types/IMod";
import {
  UNINSTALLING_ACTIVITY,
  uninstallMods,
} from "@/extensions/mod_management/util/uninstall_mods/uninstallMods";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { activeGameId } from "@/util/selectors";

/** A file the user has of a mod: an installed mod, or a download nothing is installed from. */
export type OwnedModFile =
  | {
      kind: "installed";
      /** The installed mod's id. */
      modId: string;
      /** The download it was installed from, which deleting archives deletes. */
      archiveId?: string;
      /** Whether Vortex still has that download, so it could be reinstalled without one. */
      hasDownload: boolean;
      /**
       * The other mods installed from that download, which keep it unless they go too: ids in this
       * game, and `game/id` for another game's.
       */
      otherArchiveUsers: string[];
      /** Its name with version and variant, as the Mods page shows it. */
      name: string;
    }
  | {
      kind: "downloaded";
      /** The download's id. */
      downloadId: string;
      /** Its file's name and version. */
      name: string;
    };

/** What `ownedModFiles` looks through, and the mod's key, from `modKey`, to look for. */
export type IOwnedModFileSources = IUserModFileSources & {
  key: string;
  /** Each download's mods, by id in this game and `game/id` in others; this game's when absent. */
  archiveUsers?: Map<string, string[]>;
};

/** Each download's mods across these games, by id in `gameId` and `game/id` in the others. */
const archiveUsersOf = (
  modsByGame: { [gameId: string]: { [modId: string]: IMod } | undefined },
  gameId: VortexGameId,
) => {
  const users = new Map<string, string[]>();

  for (const [game, mods] of Object.entries(modsByGame)) {
    for (const mod of Object.values(mods ?? {})) {
      if (mod.archiveId) {
        const user = game === gameId ? mod.id : `${game}/${mod.id}`;
        users.set(mod.archiveId, [...(users.get(mod.archiveId) ?? []), user]);
      }
    }
  }

  return users;
};

const NO_MODS: { [modId: string]: IMod } = {};

/** A file's key among the others, unique across installed mods and downloads. */
export const ownedFileKey = (file: OwnedModFile) =>
  file.kind === "installed" ? `mod:${file.modId}` : `download:${file.downloadId}`;

/** A file's name with its version and variant after it, as the Mods page shows them, when known. */
const versioned = (name: string, version?: string, variant?: string) =>
  [name, version && `(v${version})`, variant && `(${variant})`].filter((part) => !!part).join(" ");

/**
 * Every file the user has of a mod, from `userModFilesOf`, as the Delete modal lists them: named
 * as `storedNameOf` names them, with version and variant, and each installed one with whether its
 * download is still there and which other mods were installed from it.
 */
export const ownedModFiles = ({
  key,
  archiveUsers,
  ...sources
}: IOwnedModFileSources): OwnedModFile[] => {
  const users = archiveUsers ?? archiveUsersOf({ [sources.gameId]: sources.mods }, sources.gameId);

  return userModFilesOf(sources, key).map((owned): OwnedModFile => {
    if (owned.kind === "downloaded") {
      return {
        kind: "downloaded",
        downloadId: owned.downloadId,
        name: versioned(storedNameOf(owned), owned.download.modInfo?.nexus?.fileInfo?.version),
      };
    }

    const { mod } = owned;

    return {
      kind: "installed",
      modId: mod.id,
      archiveId: mod.archiveId,
      hasDownload: !!mod.archiveId && !!sources.downloads[mod.archiveId],
      otherArchiveUsers: mod.archiveId
        ? (users.get(mod.archiveId) ?? []).filter((user) => user !== mod.id)
        : [],
      name: versioned(storedNameOf(owned), mod.attributes?.version, mod.attributes?.variant),
    };
  });
};

/** Every file the user has of a mod in the active game, read from the store. */
export const ownedModFilesIn = (state: IState, ref: INexusModRef): OwnedModFile[] => {
  const active = activeGameId(state);

  if (!active) {
    return [];
  }

  return ownedModFiles({
    key: modKey(ref.domain, ref.modId),
    mods: state.persistent.mods[active] ?? NO_MODS,
    downloads: state.persistent.downloads.files,
    gameId: active,
    domainOf: gameDomains(state),
    archiveUsers: archiveUsersOf(state.persistent.mods, active),
  });
};

/**
 * How removing these chosen files splits: those that go for good, being downloads, installed
 * files with no download to keep, or ones whose download is deleted with every mod using it
 * chosen; and those uninstalled, keeping a download to reinstall from.
 */
export const removalCounts = (chosen: OwnedModFile[], deleteDownloads: boolean) => {
  const chosenModIds = new Set(
    chosen.map((file) => (file.kind === "installed" ? file.modId : undefined)),
  );

  const isGoneForGood = (file: OwnedModFile) => {
    if (file.kind === "downloaded" || !file.hasDownload) {
      return true;
    }

    return deleteDownloads && file.otherArchiveUsers.every((user) => chosenModIds.has(user));
  };

  const deleted = chosen.filter(isGoneForGood).length;

  return { deleted, uninstalled: chosen.length - deleted };
};

/** Whether any of a mod's installed mods is being uninstalled, by Browse or the Mods page. */
export const isUninstallingIn = (state: IState, ref: INexusModRef) => {
  const uninstalling = state.session?.base?.activity?.[UNINSTALLING_ACTIVITY] ?? [];
  const group = modInstallGroups(state)?.get(modKey(ref.domain, ref.modId));

  return !!group?.mods.some((modId) => uninstalling.includes(modId));
};

/** How `deleteModFiles` deletes the installed files it's given. */
interface IDeleteOptions {
  /** Deletes the archives they were installed from too. */
  deleteArchives: boolean;
}

/** Every archive a mod in any game is still installed from. */
const archivesInUse = (state: IState) =>
  new Set(
    Object.values(state.persistent.mods).flatMap((mods) =>
      Object.values(mods ?? {}).map((mod) => mod.archiveId),
    ),
  );

/** Deletes a download, resolving once it's gone; a failure is reported, not thrown. */
const removeDownload = (api: IExtensionApi, downloadId: string) =>
  new Promise<void>((resolve) => {
    api.events.emit(
      "remove-download",
      downloadId,
      (err: Error | null) => {
        if (err) {
          api.showErrorNotification("Failed to delete download", err);
        }

        resolve();
      },
      { confirmed: true },
    );
  });

/**
 * Removes these files of a mod from all profiles: installed ones uninstalled as the Mods page
 * does, with failures said there, then, once they're all gone, downloads deleted, and asked to,
 * the archives the installed ones came from. An archive another mod is still installed from is
 * kept, and each is deleted once. If uninstalling is cancelled or fails, nothing is deleted.
 * Resolves once every deletion has finished.
 */
export const deleteModFiles = async (
  api: IExtensionApi,
  gameId: VortexGameId,
  files: OwnedModFile[],
  { deleteArchives }: IDeleteOptions,
): Promise<void> => {
  const installed = files.filter((file) => file.kind === "installed");

  const isUninstalled = await uninstallMods(
    api,
    gameId,
    installed.map((file) => file.modId),
  );

  if (!isUninstalled) {
    return;
  }

  const inUse = archivesInUse(api.getState());
  const archives = deleteArchives
    ? installed.filter((file) => file.hasDownload).map((file) => file.archiveId)
    : [];
  const downloads = files.map((file) => (file.kind === "downloaded" ? file.downloadId : undefined));

  const toDelete = [...new Set([...archives, ...downloads])].filter((id) => !!id && !inUse.has(id));

  await Promise.all(toDelete.map((id) => removeDownload(api, id)));
};

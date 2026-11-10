import * as path from "node:path";

import { relativePath } from "@nexusmods/paths";
import { VortexGameId, type VortexModStagingFolder } from "@vortex/shared";

import type { IExtensionApi } from "@/types/IExtensionContext";
import type { FileTreeEntry } from "@/ui/components/file_tree/buildTree";

import { FlagService } from "../../FlagService";
import { getBatchContext } from "../../util/BatchContext";
import { getCollectionActiveSession } from "../../util/collectionInstallSessionSelectors";
import { UserCanceled } from "../../util/CustomErrors";
import type { ManualInstallerEventContext } from "../analytics/utils/manualInstallerEvent";
import { emitManualInstallerEvent } from "../analytics/utils/manualInstallerEvent";
import { setManualInstallerPreferences } from "../gamemode_management/actions/persistent";
import { discoveryByGame } from "../gamemode_management/selectors";
import { isTierZeroManagedGame, tierZeroGameFor } from "../gamemode_management/tiered/tierZero";
import { requestManualInstallerDestination } from "./manualInstallerQueue";
import { createManualInstallerTracker, manualInstallerUIDs } from "./manualInstallerTracker";
import type { IInstruction } from "./types/IInstallResult";
import type { ICommonModAttributes, IModReference } from "./types/IMod";
import type { InstallFunc } from "./types/InstallFunc";
import type { TestSupported } from "./types/TestSupported";

declare module "./types/IMod" {
  interface ICommonModAttributes {
    /** folder, relative to the game root, the Manual Installer placed the mod's files in */
    installDestination?: string;
    /** the Manual Installer left out the folder all files of the archive were in */
    installSkipTopFolder?: boolean;
  }
}

export const INSTALL_DESTINATION_ATTRIBUTE =
  "installDestination" as const satisfies keyof ICommonModAttributes;

export const INSTALL_SKIP_TOP_FOLDER_ATTRIBUTE =
  "installSkipTopFolder" as const satisfies keyof ICommonModAttributes;

export const MANUAL_INSTALLER_ID = "manual-installer";

// after the script-based FOMOD installers (10, 20), before the FOMOD "Basic" catch-all (100)
export const MANUAL_INSTALLER_PRIORITY = 50;

// keys in the batch context, which is shared with the other installers
const BATCH_DESTINATION_KEY = "manual-installer-destination";
// our own counter: "items-completed" is only incremented by the replace dialog flow
const BATCH_COMPLETED_KEY = "manual-installer-completed";

interface IDestination {
  folder: string;
  skipTopFolder: boolean;
}

/**
 * Normalizes a user-entered folder to one relative to the game root. The empty string is the game
 * root itself. Returns undefined if the folder would leave the game root.
 */
export function normalizeDestination(input: string): string | undefined {
  const trimmed = input.trim();
  if (trimmed === "") {
    return "";
  }
  if (path.isAbsolute(trimmed) || path.win32.isAbsolute(trimmed) || /^[\\/]/.test(trimmed)) {
    return undefined;
  }
  const normalized = path.normalize(trimmed.replace(/[\\/]+/g, path.sep));
  if (normalized === "." || normalized === "") {
    return "";
  }
  if (normalized.split(path.sep).includes("..")) {
    return undefined;
  }
  return normalized.replace(/[\\/]+$/, "");
}

// an archive entry has the platform's separators and marks a directory with a trailing one
const toFileTreeEntry = (name: string): FileTreeEntry => ({
  path: relativePath(name),
  kind: /[\\/]$/.test(name) ? "directory" : "file",
});

/** the folder all files of the archive are in, if there is a single one */
export function commonTopFolder(files: string[]): string | undefined {
  let top: string | undefined;
  for (const file of files) {
    const segments = file.split(/[\\/]/).filter((segment) => segment !== "");
    if (segments.length < 2 && !file.endsWith(path.sep)) {
      // a file at the archive root
      return undefined;
    }
    if (top !== undefined && segments[0] !== top) {
      return undefined;
    }
    top = segments[0];
  }
  return top;
}

/** where a file of the archive ends up, relative to the game root */
export function finalPath(folder: string, file: string, skipTopFolder: boolean): string {
  const relative = skipTopFolder ? file.split(/[\\/]/).slice(1).join(path.sep) : file;
  return path.join(folder, relative);
}

export function createManualInstaller(api: IExtensionApi): {
  testSupported: TestSupported;
  install: InstallFunc;
} {
  const testSupported: TestSupported = (_, vortexGameId) => {
    const supported =
      FlagService.instance?.getFlag("vortex-tier-0-game-support") !== undefined &&
      isTierZeroManagedGame(api.getState(), VortexGameId(vortexGameId));
    return Promise.resolve({ supported, requiredFiles: [] });
  };

  const tracker = createManualInstallerTracker(api);

  // folders the user picked in the dialog, by archive, until that install is known to have
  // finished: nothing else (saved choice, batch reuse, unattended) is ever reported
  const pendingEvents = new Map<string, ManualInstallerEventContext>();
  api.events.on("did-install-mod", (_gameId: string, archiveId: string) => {
    const pending = pendingEvents.get(archiveId);
    if (pending !== undefined) {
      pendingEvents.delete(archiveId);
      void emitManualInstallerEvent(api, pending);
    }
  });

  const queryDestination = async (
    vortexGameId: VortexGameId,
    files: string[],
    modName: string,
    ownStagingFolders: VortexModStagingFolder[],
    batchId: string | undefined,
    uids: { mod_uid?: string; file_uid?: string },
  ): Promise<IDestination> => {
    const entry = tierZeroGameFor(api.getState(), vortexGameId);
    const batch = batchId !== undefined ? getBatchContext("install-mod", batchId) : undefined;
    const remaining =
      batch !== undefined ? batch.itemCount - batch.get<number>(BATCH_COMPLETED_KEY, 0) - 1 : 0;

    const answer = await requestManualInstallerDestination(api, {
      gameId: vortexGameId,
      modName,
      remaining: Math.max(remaining, 0),
      defaultFolder: entry?.manualInstallerPreferences?.defaultFolder,
      gameFolder: discoveryByGame(api.getState(), vortexGameId)?.path ?? "",
      files: files.map(toFileTreeEntry),
      ownStagingFolders,
      topFolder: commonTopFolder(files),
    });

    if (answer === undefined) {
      tracker.trackClosed({ outcome: "cancelled", ...uids });
      throw new UserCanceled();
    }
    tracker.trackClosed({ outcome: "completed", ...uids });

    // the dialog only offers folders it validated
    const destination: IDestination = {
      folder: normalizeDestination(answer.folder) ?? "",
      skipTopFolder: answer.skipTopFolder,
    };

    if (answer.useAsDefault && entry !== undefined) {
      api.store?.dispatch(
        setManualInstallerPreferences(entry.gameId, {
          defaultFolder: destination.folder,
          dontAskAgain: answer.dontAskAgain,
        }),
      );
    }
    if (answer.useForAll) {
      batch?.set(BATCH_DESTINATION_KEY, destination);
    }
    return destination;
  };

  const resolveDestination = async (
    vortexGameId: VortexGameId,
    files: string[],
    modName: string,
    ownStagingFolders: VortexModStagingFolder[],
    unattended: boolean | undefined,
    previous: IDestination | undefined,
    batchId: string | undefined,
    uids: { mod_uid?: string; file_uid?: string },
    archiveId: string | undefined,
    modReference: IModReference | undefined,
  ): Promise<IDestination> => {
    const preferences = tierZeroGameFor(api.getState(), vortexGameId)?.manualInstallerPreferences;
    const defaultFolder = preferences?.defaultFolder;

    if (unattended === true || getCollectionActiveSession(api.getState()) !== undefined) {
      return { folder: defaultFolder ?? "", skipTopFolder: false };
    }
    // reinstalls, updates and variants keep the folder the previous install used
    if (previous !== undefined) {
      return previous;
    }

    const batch = batchId !== undefined ? getBatchContext("install-mod", batchId) : undefined;
    const forAll = batch?.get<IDestination | undefined>(BATCH_DESTINATION_KEY, undefined);
    if (forAll !== undefined) {
      return forAll;
    }
    if (defaultFolder !== undefined && preferences?.dontAskAgain === true) {
      return { folder: defaultFolder, skipTopFolder: false };
    }
    const picked = await queryDestination(
      vortexGameId,
      files,
      modName,
      ownStagingFolders,
      batchId,
      uids,
    );
    // only a confirmed dialog is reported, and only if the install then succeeds
    if (archiveId !== undefined) {
      pendingEvents.set(archiveId, {
        gameId: vortexGameId,
        destination: picked.folder,
        modReference,
      });
    }
    return picked;
  };

  const install: InstallFunc = async (
    files,
    _destinationPath,
    vortexGameId,
    _progress,
    _choices,
    unattended,
    archivePath,
    options,
  ) => {
    // an earlier install of this archive that never finished must not be reported now
    if (options?.archiveId !== undefined) {
      pendingEvents.delete(options.archiveId);
    }
    const previousFolder = options?.previousAttributes?.[INSTALL_DESTINATION_ATTRIBUTE];
    const batch =
      options?.archiveId !== undefined
        ? getBatchContext("install-mod", options.archiveId)
        : undefined;

    let destination: IDestination;
    try {
      destination = await resolveDestination(
        VortexGameId(vortexGameId),
        files,
        path.basename(archivePath ?? "", path.extname(archivePath ?? "")),
        [
          ...new Set(
            [options?.stagingFolder, options?.previousStagingFolder].filter(
              (folder) => folder !== undefined,
            ),
          ),
        ],
        unattended,
        typeof previousFolder === "string"
          ? {
              folder: previousFolder,
              skipTopFolder:
                options?.previousAttributes?.[INSTALL_SKIP_TOP_FOLDER_ATTRIBUTE] === true,
            }
          : undefined,
        options?.archiveId,
        manualInstallerUIDs(vortexGameId, options?.modReference),
        options?.archiveId,
        options?.modReference,
      );
    } finally {
      // counts cancelled installs too, they are no longer remaining
      batch?.set(BATCH_COMPLETED_KEY, batch.get<number>(BATCH_COMPLETED_KEY, 0) + 1);
    }

    const copy: IInstruction[] = files
      .filter((name) => !name.endsWith(path.sep))
      .map((name) => ({
        type: "copy",
        source: name,
        destination: finalPath(destination.folder, name, destination.skipTopFolder),
      }));

    const attributes: IInstruction[] = [
      { type: "attribute", key: INSTALL_DESTINATION_ATTRIBUTE, value: destination.folder },
      {
        type: "attribute",
        key: INSTALL_SKIP_TOP_FOLDER_ATTRIBUTE,
        value: destination.skipTopFolder,
      },
    ];

    return { instructions: [...copy, ...attributes] };
  };

  return { testSupported, install };
}

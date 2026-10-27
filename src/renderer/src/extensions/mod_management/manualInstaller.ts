import * as path from "node:path";

import { VortexGameId } from "@vortex/shared";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { FlagService } from "../../FlagService";
import { getCollectionActiveSession } from "../../util/collectionInstallSessionSelectors";
import { UserCanceled } from "../../util/CustomErrors";
import { isTierZeroManagedGame } from "../gamemode_management/tiered/tierZero";
import { createManualInstallerTracker, manualInstallerUIDs } from "./manualInstallerTracker";
import type { IInstruction } from "./types/IInstallResult";
import type { ICommonModAttributes } from "./types/IMod";
import type { InstallFunc } from "./types/InstallFunc";
import type { TestSupported } from "./types/TestSupported";

declare module "./types/IMod" {
  interface ICommonModAttributes {
    /** folder, relative to the game root, the Manual Installer placed the mod's files in */
    installDestination?: string;
  }
}

export const INSTALL_DESTINATION_ATTRIBUTE =
  "installDestination" as const satisfies keyof ICommonModAttributes;

export const MANUAL_INSTALLER_ID = "manual-installer";

// after the script-based FOMOD installers (10, 20), before the FOMOD "Basic" catch-all (100)
export const MANUAL_INSTALLER_PRIORITY = 50;

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

  const queryDestination = async (uids: {
    mod_uid?: string;
    file_uid?: string;
  }): Promise<string> => {
    const result = await api.showDialog?.(
      "question",
      "Tier 0 Manual Installer",
      {
        text:
          "Choose the folder inside the game directory to install this mod into. " +
          "Leave it empty to install into the game directory itself.",
        input: [
          {
            id: "folder",
            value: "",
            label: "Folder",
            placeholder: "e.g. Mods/MyMod",
          },
        ],
        condition: (content) => {
          const value = content.input.find((inp) => inp.id === "folder")?.value ?? "";
          return normalizeDestination(value) === undefined
            ? [
                {
                  id: "folder",
                  actions: ["Install"],
                  errorText: api.translate("The folder must be inside the game directory"),
                },
              ]
            : [];
        },
      },
      [{ label: "Cancel" }, { label: "Install" }],
    );

    if (result === undefined || result.action === "Cancel") {
      tracker.trackClosed({ outcome: "cancelled", ...uids });
      throw new UserCanceled();
    }
    tracker.trackClosed({ outcome: "completed", ...uids });
    // the condition keeps invalid input from reaching this point
    return normalizeDestination(result.input.folder ?? "") ?? "";
  };

  const resolveDestination = async (
    unattended: boolean | undefined,
    previous: string | undefined,
    uids: { mod_uid?: string; file_uid?: string },
  ): Promise<string> => {
    if (unattended === true || getCollectionActiveSession(api.getState()) !== undefined) {
      return "";
    }
    // reinstalls, updates and variants keep the folder the previous install used
    if (typeof previous === "string") {
      return previous;
    }
    return queryDestination(uids);
  };

  const install: InstallFunc = async (
    files,
    _destinationPath,
    vortexGameId,
    _progress,
    _choices,
    unattended,
    _archivePath,
    options,
  ) => {
    const destination = await resolveDestination(
      unattended,
      options?.previousAttributes?.[INSTALL_DESTINATION_ATTRIBUTE],
      manualInstallerUIDs(vortexGameId, options?.modReference),
    );
    const copy: IInstruction[] = files
      .filter((name) => !name.endsWith(path.sep))
      .map((name) => ({
        type: "copy",
        source: name,
        destination: path.join(destination, name),
      }));

    const attribute: IInstruction = {
      type: "attribute",
      key: INSTALL_DESTINATION_ATTRIBUTE,
      value: destination,
    };

    return { instructions: [...copy, attribute] };
  };

  return { testSupported, install };
}

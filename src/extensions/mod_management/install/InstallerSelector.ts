/**
 * InstallerSelector - Provides installer selection and mod type determination.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module handles:
 * - Selecting the appropriate installer for an archive
 * - Determining mod type from installation instructions
 * - Reporting unsupported installer instructions
 */

import * as path from "path";
import Bluebird from "bluebird";

import { showDialog } from "../../../actions/notifications";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IHashResult } from "modmeta-db";
import {
  createErrorReport,
  didIgnoreError,
  isOutdated,
} from "../../../util/errorHandling";
import { log } from "../../../util/log";
import { getErrorMessageOrDefault } from "../../../shared/errors";

import type { IModType } from "../../gamemode_management/types/IModType";
import { getGame } from "../../gamemode_management/util/getGame";

import type { IInstruction } from "../types/IInstallResult";
import type {
  IModInstaller,
  ISupportedInstaller,
} from "../types/IModInstaller";
import type {
  ISupportedResult,
  ITestSupportedDetails,
} from "../types/TestSupported";
import deriveModInstallName from "../modIdManager";

/**
 * Recursively find an installer that supports the given file list.
 *
 * This function iterates through registered installers in priority order,
 * testing each one until it finds one that supports the archive.
 *
 * @param installers - Array of registered installers sorted by priority
 * @param fileList - List of files in the archive
 * @param gameId - Target game ID
 * @param archivePath - Path to the archive being installed
 * @param offset - Current position in installer array (for recursion)
 * @param details - Additional details for testing
 * @returns The supported installer with required files, or undefined if none match
 */
export function getInstaller(
  installers: IModInstaller[],
  fileList: string[],
  gameId: string,
  archivePath: string,
  offset?: number,
  details?: ITestSupportedDetails,
): Bluebird<ISupportedInstaller> {
  const currentOffset = offset || 0;
  if (currentOffset >= installers.length) {
    return Bluebird.resolve(undefined);
  }
  return Bluebird.resolve(
    installers[currentOffset].testSupported(
      fileList,
      gameId,
      archivePath,
      details,
    ),
  ).then((testResult: ISupportedResult) => {
    if (testResult === undefined) {
      log("error", "Buggy installer", installers[currentOffset].id);
    }
    return testResult?.supported === true
      ? Bluebird.resolve({
          installer: installers[currentOffset],
          requiredFiles: testResult.requiredFiles,
        })
      : getInstaller(
          installers,
          fileList,
          gameId,
          archivePath,
          currentOffset + 1,
          details,
        );
  });
}

/**
 * Determine the mod type from installation instructions.
 *
 * This tests the installation instructions against each mod type registered
 * for the game, in priority order, to determine the appropriate mod type.
 *
 * @param gameId - The game ID
 * @param installInstructions - Instructions from the installer
 * @returns The mod type ID, or empty string if no match
 */
export function determineModType(
  gameId: string,
  installInstructions: IInstruction[],
): Bluebird<string> {
  log("info", "determine mod type", { gameId });
  const game = getGame(gameId);
  if (game === undefined) {
    return Bluebird.reject(new Error(`Invalid game "${gameId}"`));
  }
  const modTypes: IModType[] = game.modTypes;
  const sorted = modTypes.sort((lhs, rhs) => lhs.priority - rhs.priority);
  let found = false;

  return Bluebird.mapSeries(sorted, (type: IModType): Bluebird<string> => {
    if (found) {
      return Bluebird.resolve<string>(null);
    }

    try {
      return type.test(installInstructions).then((matches) => {
        if (matches) {
          found = true;
          return Bluebird.resolve(type.typeId);
        } else {
          return Bluebird.resolve(null);
        }
      });
    } catch (err) {
      log("error", "invalid mod type", {
        typeId: type.typeId,
        error: getErrorMessageOrDefault(err),
      });
      return Bluebird.resolve(null);
    }
  }).then((matches) => matches.find((match) => match !== null) || "");
}

/**
 * Derive the installation name for a mod from the archive name and info.
 *
 * @param archiveName - Name of the archive file
 * @param info - Mod info metadata
 * @returns The derived installation name
 */
export function deriveInstallName(archiveName: string, info: any): string {
  return deriveModInstallName(archiveName, info);
}

/**
 * Report unsupported installer instructions to the user.
 *
 * This shows a notification and optionally a dialog when an installer
 * uses functionality that hasn't been implemented yet.
 *
 * @param api - Extension API for notifications and dialogs
 * @param unsupported - List of unsupported instructions
 * @param archivePath - Path to the archive being installed
 */
export function reportUnsupported(
  api: IExtensionApi,
  unsupported: IInstruction[],
  archivePath: string,
): void {
  if (unsupported.length === 0) {
    return;
  }
  const missing = unsupported.map((instruction) => instruction.source);
  const makeReport = () =>
    api
      .genMd5Hash(archivePath)
      .catch((err) => ({}))
      .then((hashResult: IHashResult) =>
        createErrorReport(
          "Installer failed",
          {
            message: "The installer uses unimplemented functions",
            details:
              `Missing instructions: ${missing.join(", ")}\n` +
              `Installer name: ${path.basename(archivePath)}\n` +
              `MD5 checksum: ${hashResult.md5sum}\n`,
          },
          {},
          ["installer"],
          api.store.getState(),
        ),
      );
  const showUnsupportedDialog = () =>
    api.store.dispatch(
      showDialog(
        "info",
        "Installer unsupported",
        {
          message:
            "This installer is (partially) unsupported as it's " +
            "using functionality that hasn't been implemented yet. " +
            "Please help us fix this by submitting an error report with a link to this mod.",
        },
        isOutdated() || didIgnoreError()
          ? [{ label: "Close" }]
          : [{ label: "Report", action: makeReport }, { label: "Close" }],
      ),
    );

  api.sendNotification({
    type: "info",
    message: "Installer unsupported",
    actions: [{ title: "More", action: showUnsupportedDialog }],
  });
}

/**
 * InstallerSelector class - provides installer selection utilities as instance methods.
 *
 * This class wraps the standalone functions for cases where dependency injection
 * or a class-based interface is preferred. It holds a reference to the installers
 * array to allow for simpler method signatures.
 */
export class InstallerSelector {
  private mInstallers: IModInstaller[];

  /**
   * Create an InstallerSelector.
   *
   * @param installers - Array of registered mod installers (shared reference)
   */
  constructor(installers: IModInstaller[]) {
    this.mInstallers = installers;
  }

  /**
   * Find an installer that supports the given file list.
   */
  public getInstaller(
    fileList: string[],
    gameId: string,
    archivePath: string,
    offset?: number,
    details?: ITestSupportedDetails,
  ): Bluebird<ISupportedInstaller> {
    return getInstaller(
      this.mInstallers,
      fileList,
      gameId,
      archivePath,
      offset,
      details,
    );
  }

  /**
   * Determine the mod type from installation instructions.
   */
  public determineModType(
    gameId: string,
    installInstructions: IInstruction[],
  ): Bluebird<string> {
    return determineModType(gameId, installInstructions);
  }

  /**
   * Derive the installation name for a mod.
   */
  public deriveInstallName(archiveName: string, info: any): string {
    return deriveInstallName(archiveName, info);
  }

  /**
   * Report unsupported installer instructions.
   */
  public reportUnsupported(
    api: IExtensionApi,
    unsupported: IInstruction[],
    archivePath: string,
  ): void {
    return reportUnsupported(api, unsupported, archivePath);
  }
}

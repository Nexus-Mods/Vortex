/**
 * Registers Stardew Valley archive installers and priorities with Vortex.
 */
import type { types } from "vortex-api";

import {
  INSTALLER_ID_MANIFEST,
  INSTALLER_ID_ROOT,
  INSTALLER_ID_SMAPI,
  INSTALLER_PRIORITY_MANIFEST,
  INSTALLER_PRIORITY_ROOT,
  INSTALLER_PRIORITY_SMAPI,
} from "../common";
import {
  installRootFolder,
  testRootFolder,
} from "../installers/rootFolderInstaller";
import { installSMAPI, testSMAPI } from "../installers/smapi";
import {
  installStardewValley,
  testSupported,
} from "../installers/stardewValleyInstaller";

/**
 * Registers archive installers used by the Stardew Valley extension.
 *
 * Installer priorities are intentionally preserved from the legacy setup:
 * - SMAPI installer (`30`)
 * - Root-folder installer (`50`)
 * - Manifest-based Stardew installer (`50`)
 */
export function registerInstallers(
  context: types.IExtensionContext,
  getGameInstallPath: () => string,
): void {
  context.registerInstaller(
    INSTALLER_ID_SMAPI,
    INSTALLER_PRIORITY_SMAPI,
    testSMAPI,
    (files, destinationPath) =>
      installSMAPI(getGameInstallPath, files, destinationPath),
  );

  context.registerInstaller(
    INSTALLER_ID_ROOT,
    INSTALLER_PRIORITY_ROOT,
    testRootFolder,
    installRootFolder,
  );

  context.registerInstaller(
    INSTALLER_ID_MANIFEST,
    INSTALLER_PRIORITY_MANIFEST,
    testSupported,
    (files, destinationPath) =>
      installStardewValley(context.api, files, destinationPath),
  );
}

/* eslint-disable */
import Bluebird from 'bluebird';

import type { types } from 'vortex-api';

import type DependencyManager from '../DependencyManager';
import { installRootFolder, testRootFolder } from '../installers/rootFolderInstaller';
import { installSMAPI, testSMAPI } from '../installers/smapiInstaller';
import { installStardewValley, testSupported } from '../installers/stardewValleyInstaller';

/**
 * Registers archive installers used by the Stardew Valley extension.
 *
 * Installer priorities are intentionally preserved from the legacy setup:
 * - SMAPI installer (`30`)
 * - Root-folder installer (`50`)
 * - Manifest-based Stardew installer (`50`)
 */
export function registerInstallers(context: types.IExtensionContext,
                                   getDiscoveryPath: () => string,
                                   dependencyManager: DependencyManager) {
  context.registerInstaller('smapi-installer', 30, testSMAPI,
    (files, destinationPath) => Bluebird.resolve(installSMAPI(getDiscoveryPath, files, destinationPath)));

  context.registerInstaller('sdvrootfolder', 50, testRootFolder, installRootFolder);

  context.registerInstaller('stardew-valley-installer', 50, testSupported,
    (files, destinationPath) => Bluebird.resolve(
      installStardewValley(context.api, dependencyManager, files, destinationPath)));
}

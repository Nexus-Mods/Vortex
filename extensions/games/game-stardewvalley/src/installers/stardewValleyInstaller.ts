/* eslint-disable */
import Bluebird from 'bluebird';
import path from 'path';
import { log, types } from 'vortex-api';

import type DependencyManager from '../DependencyManager';
import { classifyArchive, makeInstallerTestResult } from './archiveClassifier';
import type { IInstallerTestResult, ISDVDependency, ISDVModManifest } from '../types';
import { parseManifest } from '../util';

/**
 * Primary Stardew Valley installer for manifest-based SMAPI mods.
 *
 * This module owns detection and installation for archives that include one or
 * more valid `manifest.json` files and are intended for deployment under the
 * game's mod path.
 *
 * Exports:
 * - `MANIFEST_FILE`: canonical manifest filename used by installer/mod-type logic.
 * - `testSupported`: installer matcher for manifest-based Stardew mods.
 * - `installStardewValley`: installer that copies files and generates dependency rules.
 */
export const MANIFEST_FILE = 'manifest.json';

function isValidManifest(filePath: string): boolean {
  const segments = filePath.toLowerCase().split(path.sep);
  const isManifestFile = segments[segments.length - 1] === MANIFEST_FILE;
  const isLocale = segments.includes('locale');
  return isManifestFile && !isLocale;
}

export function testSupported(files: string[], gameId: string): Bluebird<IInstallerTestResult> {
  const archiveInfo = classifyArchive(files, gameId);
  const supported = archiveInfo.isGameArchive
    && archiveInfo.hasManifest
    && !archiveInfo.hasContentFolder;
  return Bluebird.resolve(makeInstallerTestResult(supported));
}

export async function installStardewValley(api: types.IExtensionApi,
                                           dependencyManager: DependencyManager,
                                           files: string[],
                                           destinationPath: string): Promise<types.IInstallResult> {
  // The archive may contain multiple manifest files which would
  //  imply that we're installing multiple mods.
  const manifestFiles = files.filter(isValidManifest);

  interface IModInfo {
    manifest: ISDVModManifest;
    rootFolder: string;
    manifestIndex: number;
    modFiles: string[];
  }

  let parseError: unknown;

  await dependencyManager.scanManifests(true);
  const scannedMods = await Promise.all(manifestFiles.map(async manifestFile => {
    const rootFolder = path.dirname(manifestFile);
    const rootSegments = rootFolder.toLowerCase().split(path.sep);
    const manifestIndex = manifestFile.toLowerCase().indexOf(MANIFEST_FILE);
    const filterFunc = (file: string) => {
      const isFile = !file.endsWith(path.sep) && path.extname(path.basename(file)) !== '';
      const fileSegments = file.toLowerCase().split(path.sep);
      const isInRootFolder = (rootSegments.length > 0)
        ? fileSegments?.[rootSegments.length - 1] === rootSegments[rootSegments.length - 1]
        : true;
      return isInRootFolder && isFile;
    };
    try {
      const manifest: ISDVModManifest =
        await parseManifest(path.join(destinationPath, manifestFile));
      const modFiles = files.filter(filterFunc);
      return {
        manifest,
        rootFolder,
        manifestIndex,
        modFiles,
      };
    } catch (err) {
      const parsedErr = err instanceof Error
        ? err
        : new Error(String(err));
      // just a warning at this point as this may not be the main manifest for the mod
      log('warn', 'Failed to parse manifest', { manifestFile, error: parsedErr.message });
      parseError = parsedErr;
      return undefined;
    }
  }));

  const mods: IModInfo[] = scannedMods.filter((mod): mod is IModInfo => mod !== undefined);

  if (mods.length === 0) {
    api.showErrorNotification?.(
      'The mod manifest is invalid and can\'t be read. You can try to install the mod anyway via right-click -> "Unpack (as-is)"',
      parseError ?? new Error('Unknown manifest parse error'), {
      allowReport: false,
    });
  }

  return Bluebird.map(mods, mod => {
    // TODO: we might get here with a mod that has a manifest.json file but wasn't intended for Stardew Valley, all
    //  thunderstore mods will contain a manifest.json file
    const modName = (mod.rootFolder !== '.')
      ? mod.rootFolder
      : mod.manifest.Name ?? mod.rootFolder;

    if (modName === undefined) {
      return [];
    }

    const dependencies = mod.manifest.Dependencies || [];

    const instructions: types.IInstruction[] = [];

    for (const file of mod.modFiles) {
      const destination = path.join(modName, file.substr(mod.manifestIndex));
      instructions.push({
        type: 'copy',
        source: file,
        destination: destination,
      });
    }

    const addRuleForDependency = (dep: ISDVDependency) => {
      if ((dep.UniqueID === undefined)
          || (dep.UniqueID.toLowerCase() === 'yourname.yourotherspacksandmods')) {
        return;
      }

      const versionMatch = dep.MinimumVersion !== undefined
        ? `>=${dep.MinimumVersion}`
        : '*';
      const rule = {
        // treating all dependencies as recommendations because the dependency information
        // provided by some mod authors is a bit hit-and-miss and Vortex fairly aggressively
        // enforces requirements
        // type: (dep.IsRequired ?? true) ? 'requires' : 'recommends',
        type: 'recommends',
        reference: {
          logicalFileName: dep.UniqueID.toLowerCase(),
          versionMatch,
        } as any,
        extra: {
          onlyIfFulfillable: true,
          automatic: true,
        },
      } as any;
      instructions.push({
        type: 'rule',
        rule,
      });
    }

    /*
    if (api.getState().settings['SDV']?.useRecommendations ?? false) {
      for (const dep of dependencies) {
        addRuleForDependency(dep);
      }
      if (mod.manifest.ContentPackFor !== undefined) {
        addRuleForDependency(mod.manifest.ContentPackFor);
      }
    }*/
    return instructions;
  })
    .then((data: types.IInstruction[][]) => {
      const instructions = data.reduce<types.IInstruction[]>((accum, iter) => accum.concat(iter), []);
      return Promise.resolve({ instructions });
    });
}

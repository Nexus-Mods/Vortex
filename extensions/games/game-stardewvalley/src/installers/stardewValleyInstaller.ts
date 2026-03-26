/**
 * Detects and installs manifest-based Stardew Valley mod archives.
 */
import path from "path";
import { RelativePath } from "@vortex/paths";
import { log } from "vortex-api";
import type { types } from "vortex-api";

import { MOD_MANIFEST } from "../common";
import type { IArchiveEntryPath } from "./archivePath";
import {
  getArchiveExtension,
  isArchiveDirectoryEntry,
  toArchiveEntries,
  toLowerCaseSegments,
} from "./archivePath";
import { classifyArchive, makeInstallerTestResult } from "./archiveClassifier";
import { parseManifest } from "../manifests/parseManifest";
import type {
  IInstallerTestResult,
  ISDVDependency,
  ISDVModManifest,
} from "../types";

/** Tests whether an archive should be handled by the manifest-based installer. */
export function testSupported(
  files: string[],
  gameId: string,
): PromiseLike<IInstallerTestResult> {
  const archiveInfo = classifyArchive(files, gameId);
  const supported =
    archiveInfo.isGameArchive &&
    archiveInfo.hasManifest &&
    !archiveInfo.hasContentFolder;
  return Promise.resolve(makeInstallerTestResult(supported));
}

/** Builds install instructions for one or more valid manifest-based SDV mods. */
export async function installStardewValley(
  api: types.IExtensionApi,
  files: string[],
  destinationPath: string,
): Promise<types.IInstallResult> {
  // The archive may contain multiple manifest files which would
  //  imply that we're installing multiple mods.
  const archiveEntries = toArchiveEntries(files);
  const manifestFiles = archiveEntries.filter((entry) =>
    isValidManifest(entry.relative),
  );

  interface IModInfo {
    manifest: ISDVModManifest;
    rootFolder: RelativePath;
    manifestIndex: number;
    modFiles: IArchiveEntryPath[];
  }

  let parseError: unknown;

  const scannedMods = await Promise.all(
    manifestFiles.map(async ({ relative: manifestFile }) => {
      const manifestPath = RelativePath.toString(manifestFile);
      const rootFolder = RelativePath.dirname(manifestFile);
      const rootSegments = toLowerCaseSegments(rootFolder);
      const manifestIndex = manifestPath.toLowerCase().indexOf(MOD_MANIFEST);
      const filterFunc = (file: IArchiveEntryPath) => {
        const isFile =
          !isArchiveDirectoryEntry(file.original) &&
          getArchiveExtension(file.relative) !== "";
        if (rootFolder === RelativePath.EMPTY) {
          return false;
        }
        const fileSegments = toLowerCaseSegments(file.relative);
        const isInRootFolder =
          rootSegments.length > 0 &&
          fileSegments[rootSegments.length - 1] ===
            rootSegments[rootSegments.length - 1];
        return isInRootFolder && isFile;
      };
      try {
        const manifest: ISDVModManifest = await parseManifest(
          path.join(destinationPath, manifestPath),
        );
        const modFiles = archiveEntries.filter(filterFunc);
        return {
          manifest,
          rootFolder,
          manifestIndex,
          modFiles,
        };
      } catch (err) {
        const parsedErr = err instanceof Error ? err : new Error(String(err));
        // just a warning at this point as this may not be the main manifest for the mod
        log("warn", "Failed to parse manifest", {
          manifestFile: manifestPath,
          error: parsedErr.message,
        });
        parseError = parsedErr;
        return undefined;
      }
    }),
  );

  const mods: IModInfo[] = scannedMods.filter(
    (mod): mod is IModInfo => mod !== undefined,
  );

  if (mods.length === 0) {
    api.showErrorNotification?.(
      'The mod manifest is invalid and can\'t be read. You can try to install the mod anyway via right-click -> "Unpack (as-is)"',
      parseError ?? new Error("Unknown manifest parse error"),
      {
        allowReport: false,
      },
    );
  }

  const data = await Promise.all(
    mods.map((mod) => {
      // TODO: we might get here with a mod that has a manifest.json file but wasn't intended for Stardew Valley, all
      //  thunderstore mods will contain a manifest.json file
      const rootFolderPath = RelativePath.toString(mod.rootFolder);
      const modName =
        rootFolderPath !== ""
          ? rootFolderPath
          : (mod.manifest.Name ?? rootFolderPath);

      if (modName === undefined) {
        return [];
      }

      const instructions: types.IInstruction[] = [];

      for (const file of mod.modFiles) {
        const source = RelativePath.toString(file.relative);
        const destination = path.join(modName, source.slice(mod.manifestIndex));
        instructions.push({
          type: "copy",
          source,
          destination,
        });
      }

      const addRuleForDependency = (dep: ISDVDependency) => {
        if (
          dep.UniqueID === undefined ||
          dep.UniqueID.toLowerCase() === "yourname.yourotherspacksandmods"
        ) {
          return;
        }

        const versionMatch =
          dep.MinimumVersion !== undefined ? `>=${dep.MinimumVersion}` : "*";
        const rule = {
          // treating all dependencies as recommendations because the dependency information
          // provided by some mod authors is a bit hit-and-miss and Vortex fairly aggressively
          // enforces requirements
          // type: (dep.IsRequired ?? true) ? 'requires' : 'recommends',
          type: "recommends",
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
          type: "rule",
          rule,
        });
      };

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
    }),
  );

  const instructions = data.reduce<types.IInstruction[]>(
    (accum, iter) => accum.concat(iter),
    [],
  );
  return { instructions };
}

function isValidManifest(filePath: RelativePath): boolean {
  const isManifestFile =
    RelativePath.basename(filePath).toLowerCase() === MOD_MANIFEST;
  const isLocale = toLowerCaseSegments(RelativePath.dirname(filePath)).includes(
    "locale",
  );
  return isManifestFile && !isLocale;
}

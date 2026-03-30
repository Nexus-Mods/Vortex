/**
 * Installs Stardew archives that deploy directly into the game root.
 */
import { RelativePath } from "@vortex/paths";

import type { types } from "vortex-api";

import { GAME_ID } from "../common";
import type { IInstallerTestResult } from "../types";
import {
  getArchiveExtension,
  isArchiveDirectoryEntry,
  toArchiveEntries,
} from "./archivePath";
import { classifyArchive, makeInstallerTestResult } from "./archiveClassifier";

/** Tests whether an archive should be handled as a root-folder install. */
export function testRootFolder(
  files: string[],
  gameId: string,
): PromiseLike<IInstallerTestResult> {
  const archiveInfo = classifyArchive(files);
  const supported = gameId === GAME_ID && archiveInfo.hasContentFolder;

  return Promise.resolve(makeInstallerTestResult(supported));
}

/** Generates copy instructions that place archive files into the game root. */
export function installRootFolder(
  files: string[],
  destinationPath: string,
): PromiseLike<types.IInstallResult> {
  const archiveEntries = toArchiveEntries(files);

  // Deploy "Content/" and sibling folders into the game root.
  //  i.e. SomeMod.7z
  //  Will be deployed     => ../SomeMod/Content/
  //  Will be deployed     => ../SomeMod/Mods/
  //  Will NOT be deployed => ../Readme.doc
  const contentDir = archiveEntries.find(
    (entry) =>
      isArchiveDirectoryEntry(entry.original) &&
      RelativePath.basename(entry.relative) === CONTENT_FOLDER_NAME,
  );

  if (contentDir === undefined) {
    return Promise.resolve<types.IInstallResult>({ instructions: [] });
  }

  const contentPath = RelativePath.toString(contentDir.relative);
  const rootDir = RelativePath.basename(
    RelativePath.dirname(contentDir.relative),
  );
  const rootPrefixLength = contentPath.length - CONTENT_FOLDER_NAME.length;
  const instructions: types.IInstruction[] = archiveEntries
    .filter((entry) => !isArchiveDirectoryEntry(entry.original))
    .filter((entry) => {
      const source = RelativePath.toString(entry.relative);
      return source.indexOf(rootDir) !== -1;
    })
    .filter(
      (entry) =>
        getArchiveExtension(entry.relative) !== LOWERCASE_TEXT_EXTENSION,
    )
    .map((entry) => {
      const source = RelativePath.toString(entry.relative);
      return {
        type: "copy",
        source,
        destination: source.slice(rootPrefixLength),
      };
    });

  return Promise.resolve<types.IInstallResult>({ instructions });
}

const CONTENT_FOLDER_NAME = "Content";
const LOWERCASE_TEXT_EXTENSION = ".txt";

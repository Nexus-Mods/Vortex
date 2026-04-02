/**
 * Scans installed mod content and returns discovered `manifest.json` paths.
 */
import { ResolvedPath } from "@vortex/paths";

import turbowalk from "turbowalk";

import { MOD_MANIFEST } from "../common";

/** Recursively returns all `manifest.json` files found under a mod directory. */
export function getModManifests(modPath?: string): PromiseLike<string[]> {
  const manifests: string[] = [];

  if (modPath === undefined) {
    return Promise.resolve([]);
  }

  return Promise.resolve(
    turbowalk(
      modPath,
      (entries) => {
        for (const entry of entries) {
          if (
            ResolvedPath.basenameEqualsIgnoreCase(
              ResolvedPath.make(entry.filePath),
              MOD_MANIFEST,
            )
          ) {
            manifests.push(entry.filePath);
          }
        }
      },
      {
        skipHidden: false,
        recurse: true,
        skipInaccessible: true,
        skipLinks: true,
      },
    ),
  ).then(() => manifests);
}

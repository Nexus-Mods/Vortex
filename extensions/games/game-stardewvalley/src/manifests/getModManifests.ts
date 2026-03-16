/* eslint-disable */
import path from 'path';

import turbowalk from 'turbowalk';

/**
 * Manifest discovery helpers.
 *
 * Recursively scans a mod directory and returns all `manifest.json` paths.
 * Used by attribute extraction to infer metadata from installed content.
 */
export function getModManifests(modPath?: string): Promise<string[]> {
  const manifests: string[] = [];

  if (modPath === undefined) {
    return Promise.resolve([]);
  }

  return turbowalk(modPath, async entries => {
    for (const entry of entries) {
      if (path.basename(entry.filePath) === 'manifest.json') {
        manifests.push(entry.filePath);
      }
    }
  }, { skipHidden: false, recurse: true, skipInaccessible: true, skipLinks: true })
    .then(() => manifests);
}

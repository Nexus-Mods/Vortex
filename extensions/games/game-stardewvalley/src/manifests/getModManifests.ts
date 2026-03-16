/**
 * Scans installed mod content and returns discovered `manifest.json` paths.
 */
import path from 'path';

import turbowalk from 'turbowalk';

/** Recursively returns all `manifest.json` files found under a mod directory. */
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

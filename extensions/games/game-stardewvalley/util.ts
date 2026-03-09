import { parse } from 'relaxed-json';
import * as semver from 'semver';
import turbowalk, { IEntry, IWalkOptions } from 'turbowalk';
import { fs, util } from 'vortex-api';
import { ISDVModManifest } from './types';

export function defaultModsRelPath(): string {
  return 'Mods';
}

export async function parseManifest(manifestFilePath: string): Promise<ISDVModManifest> {
  try {
    const manifestData = await fs.readFileAsync(manifestFilePath, { encoding: 'utf-8' });
    const manifest: ISDVModManifest = parse(util.deBOM(manifestData)) as ISDVModManifest;
    if (!manifest) {
      throw new util.DataInvalid('Manifest file is invalid');
    }
    return manifest;
  } catch (err) {
    return Promise.reject(err);
  }
}

/**
 * semver.coerce drops pre-release information from a
 * perfectly valid semantic version string, don't want that
 */
export function coerce(input: string): semver.SemVer {
  try {
    return new semver.SemVer(input);
  } catch (err) {
    return semver.coerce(input);
  }
}

export function semverCompare(lhs: string, rhs: string): number {
  const l = coerce(lhs);
  const r = coerce(rhs);
  if ((l !== null) && (r !== null)) {
    return semver.compare(l, r);
  } else {
    return lhs.localeCompare(rhs, 'en-US');
  }
}

export async function walkPath(dirPath: string, walkOptions?: IWalkOptions): Promise<IEntry[]> {
  walkOptions = !!walkOptions
    ? { ...walkOptions, skipHidden: true, skipInaccessible: true, skipLinks: true }
    : { skipLinks: true, skipHidden: true, skipInaccessible: true };
  const walkResults: IEntry[] = [];
  return new Promise<IEntry[]>(async (resolve, reject) => {
    await turbowalk(dirPath, (entries: IEntry[]) => {
      walkResults.push(...entries);
      return Promise.resolve() as any;
      // If the directory is missing when we try to walk it; it's most probably down to a collection being
      //  in the process of being installed/removed. We can safely ignore this.
    }, walkOptions).catch(err => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err));
    return resolve(walkResults);
  });
}

export async function deleteFolder(dirPath: string, walkOptions?: IWalkOptions): Promise<void> {
  try {
    const entries = await walkPath(dirPath, walkOptions);
    entries.sort((a, b) => b.filePath.length - a.filePath.length);
    for (const entry of entries) {
      await fs.removeAsync(entry.filePath);
    }
    await fs.rmdirAsync(dirPath);
  } catch (err) {
    return Promise.reject(err);
  }
}

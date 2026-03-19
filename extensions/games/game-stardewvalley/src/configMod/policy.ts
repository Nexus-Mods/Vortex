/**
 * Safety rules for config-file routing and ownership validation.
 *
 * Centralizing these checks avoids accidental file ownership mistakes,
 * especially around SMAPI internal files and risky root-folder candidates.
 */
import path from 'path';

import { util } from 'vortex-api';
import type { types } from 'vortex-api';

import {
  MOD_TYPE_ROOT,
  MOD_TYPE_SMAPI,
  SMAPI_INTERNAL_DIRECTORY,
  getBundledMods,
} from '../common';
import type { IFileEntry } from '../types';

/** Returns true when runtime activity should temporarily suppress sync work. */
export function shouldSuppressSync(api: types.IExtensionApi): boolean {
  const state = api.getState();
  const suppressOnActivities = ['installing_dependencies'];
  const isActivityRunning = (activity: string) =>
    util.getSafe(state, ['session', 'base', 'activity', activity], []).length > 0;
  return suppressOnActivities.some(activity => isActivityRunning(activity));
}

/** Identifies SMAPI-internal paths that must not be imported into mods. */
export function isSmapiInternalPath(filePath: string): boolean {
  const normalizedInternalDir = SMAPI_INTERNAL_DIRECTORY.toLowerCase().replace(/[-_]/g, '');
  // Normalize separators and punctuation so smapi-internal/smapi_internal both match.
  const segments = filePath
    .toLowerCase()
    .split(path.sep)
    .filter(segment => segment.length > 0)
    .map(segment => segment.replace(/[-_]/g, ''));
  return segments.some(segment => segment === normalizedInternalDir);
}

/** Validates whether a detected candidate mod is safe for automatic file re-ingestion. */
export function isModCandidateValid(mod: types.IMod | undefined, entry: IFileEntry): mod is types.IMod {
  if ((mod === undefined) || (mod.id === undefined) || (mod.type === MOD_TYPE_ROOT)) {
    return false;
  }

  if (mod.type !== MOD_TYPE_SMAPI) {
    return true;
  }

  const segments = entry.filePath.toLowerCase().split(path.sep).filter(segment => segment.length > 0);
  const modsSegIdx = segments.indexOf('mods');
  const modFolderName = ((modsSegIdx !== -1) && (segments.length > modsSegIdx + 1))
    ? segments[modsSegIdx + 1]
    : undefined;
  // SMAPI mods should not own files in the game's root Content folder.
  if (segments.includes('content')) {
    return false;
  }

  let bundledMods: string[] = util.getSafe(mod, ['attributes', 'smapiBundledMods'], [] as string[]);
  bundledMods = bundledMods.length > 0 ? bundledMods : getBundledMods();
  return (modFolderName !== undefined) && bundledMods.includes(modFolderName);
}

import { basename } from "node:path";

import type { IExtensionState } from "../types/IState";

/**
 * Look up the random state key and entry for an installed extension using
 * known identity fields. Each non-undefined query field is matched against the
 * corresponding field on every state entry; the first entry where ANY field
 * matches is returned.
 *
 * @returns The state key and entry, or `undefined` if nothing matched.
 */
export function resolveExtension(
  extensions: Record<string, IExtensionState>,
  query: {
    /** Match against the info.json `id` field. */
    infoJsonId?: string;
    /** Match against the display name. */
    name?: string;
    /** Match against the Nexus Mods mod ID. */
    modId?: number;
    /** Exact match against the extension folder path on disk. */
    path?: string;
    /** Match against the basename of the extension folder on disk. */
    dirname?: string;
  },
): { key: string; entry: IExtensionState } | undefined {
  const { infoJsonId, name, modId, path, dirname } = query;
  for (const [key, entry] of Object.entries(extensions)) {
    if (
      (modId !== undefined && entry.modId === modId) ||
      (infoJsonId !== undefined && entry.infoJsonId === infoJsonId) ||
      (name !== undefined && entry.name === name) ||
      (path !== undefined && entry.path === path) ||
      (dirname !== undefined && basename(entry.path) === dirname)
    ) {
      return { key, entry };
    }
  }

  return undefined;
}

/**
 * Convenience form of {@link resolveExtension} for dependency / opaque-identity
 * lookups. The input string is matched against `infoJsonId`, then `name`, then
 * `modId` (coerced to string), in that priority order.
 */
export function resolveDependencyExtension(
  extensions: Record<string, IExtensionState>,
  query: string,
): { key: string; entry: IExtensionState } | undefined {
  for (const [key, entry] of Object.entries(extensions)) {
    if (
      entry.infoJsonId === query ||
      entry.name === query ||
      (entry.modId !== undefined && String(entry.modId) === query)
    ) {
      return { key, entry };
    }
  }

  return undefined;
}

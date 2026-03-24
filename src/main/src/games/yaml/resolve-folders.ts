/**
 * Folder variable resolution for the Vortex extension.
 *
 * Resolves folder templates from YAML adaptors into concrete paths
 * relative to the game root directory.
 */

import type { AdaptorDocument } from './types';

/** Variables that resolve to paths outside the game directory */
const EXTERNAL_VARIABLES = new Set([
  'documents',
  'app_data_local',
  'app_data_roaming',
  'app_data',
  'home',
  'program_files',
  'program_files_x86',
]);

/**
 * Resolve all folder variables to paths relative to game root.
 *
 * Starts with `{ game: '' }` so `{game}/Data` becomes `Data`.
 * Iteratively expands variable references (up to 10 passes) to handle
 * chains like `{binaries}` → `{bin}/x64` → `{game}/bin/x64` → `bin/x64`.
 */
export function resolveRelativeFolders(
  doc: AdaptorDocument,
): Record<string, string> {
  const resolved: Record<string, string> = { game: '' };

  // Seed with raw folder templates
  if (doc.folders) {
    for (const [key, value] of Object.entries(doc.folders)) {
      resolved[key] = value;
    }
  }

  // Iteratively expand {varname} references
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    for (const [key, value] of Object.entries(resolved)) {
      const expanded = value.replace(/\{(\w+)\}/g, (match, name) => {
        if (name in resolved && name !== key) return resolved[name];
        return match;
      });
      if (expanded !== value) {
        resolved[key] = expanded;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Strip leading '/' that results from {game}/... → /...
  for (const [key, value] of Object.entries(resolved)) {
    if (value.startsWith('/')) {
      resolved[key] = value.slice(1);
    }
  }

  return resolved;
}

/**
 * Check if any folder used in a rule's `to` template resolves to an
 * external path (outside the game directory).
 */
export function classifyFolders(
  doc: AdaptorDocument,
): { allInternal: boolean } {
  if (!doc.folders) return { allInternal: true };

  // Collect all folder variables referenced in rule destinations
  const referencedVars = new Set<string>();
  for (const rule of doc.rules) {
    const matches = rule.to.matchAll(/\{(\w+)\}/g);
    for (const match of matches) {
      referencedVars.add(match[1]);
    }
  }

  // Check if any referenced folder depends on an external variable
  for (const varName of referencedVars) {
    if (EXTERNAL_VARIABLES.has(varName)) {
      return { allInternal: false };
    }

    // Walk the folder chain to check for external dependencies
    const rawTemplate = doc.folders[varName];
    if (rawTemplate && containsExternalVar(rawTemplate, doc.folders, new Set())) {
      return { allInternal: false };
    }
  }

  return { allInternal: true };
}

function containsExternalVar(
  template: string,
  folders: Record<string, string>,
  visited: Set<string>,
): boolean {
  const matches = template.matchAll(/\{(\w+)\}/g);
  for (const match of matches) {
    const name = match[1];
    if (visited.has(name)) continue;
    visited.add(name);

    if (EXTERNAL_VARIABLES.has(name)) return true;
    if (name in folders) {
      if (containsExternalVar(folders[name], folders, visited)) return true;
    }
  }
  return false;
}

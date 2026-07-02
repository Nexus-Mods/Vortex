'use strict';

/**
 * @typedef {Object} ConflictResult
 * @property {string}   groupId      - ID of the ExclusiveVariantGroup that triggered
 * @property {string}   displayName  - Human-readable group name (for notification title)
 * @property {Array<{ modName: string, variantLabel: string }>} hits - Each conflicting mod
 */

/**
 * Pure function — no Vortex API dependency, safe to unit test.
 *
 * Given a list of installed mod display names and a list of variant groups,
 * returns one ConflictResult per group where more than one variant is active.
 *
 * @param {Array<{ name: string, nexusModId: number|undefined }>} mods
 * @param {import('./variantGroups').ExclusiveVariantGroup[]} groups
 * @returns {ConflictResult[]}
 */
function detectConflicts(mods, groups) {
  const results = [];

  for (const group of groups) {
    const hits = [];

    for (const mod of mods) {
      // For intra-mod groups, only consider mods from the matching Nexus page.
      if (group.nexusModId !== undefined && mod.nexusModId !== group.nexusModId) {
        continue;
      }

      const nameLower = mod.name.toLowerCase();
      const matchedVariant = group.variants.find(v =>
        nameLower.includes(v.match.toLowerCase())
      );

      if (matchedVariant) {
        hits.push({ modName: mod.name, variantLabel: matchedVariant.label });
      }
    }

    if (hits.length > 1) {
      results.push({
        groupId: group.id,
        displayName: group.displayName,
        hits,
      });
    }
  }

  return results;
}

module.exports = { detectConflicts };

'use strict';

/**
 * @typedef {Object} Variant
 * @property {string} match   - Case-insensitive substring matched against the mod's display name
 * @property {string} label   - Human-readable label shown in warning notifications
 */

/**
 * @typedef {Object} ExclusiveVariantGroup
 * @property {string}   id          - Unique identifier for this group
 * @property {string}   gameId      - Vortex/Nexus game identifier (e.g. 'readyornot')
 * @property {number}   [nexusModId]- When set, only mods from this Nexus page are checked.
 *                                    Omit for cross-mod groups spanning multiple Nexus pages.
 * @property {string}   displayName - Shown in the warning notification title
 * @property {Variant[]} variants   - Two or more mutually exclusive variants
 */

/** @type {ExclusiveVariantGroup[]} */
const VARIANT_GROUPS = [
  // -----------------------------------------------------------------
  // Ready or Not — intra-mod variant groups
  // (single Nexus page, multiple exclusive files)
  // -----------------------------------------------------------------
  {
    id: 'ron-no-stress',
    gameId: 'readyornot',
    nexusModId: 3278,
    displayName: 'No Stress for SWAT',
    variants: [
      { match: 'no stress',  label: 'Standard' },
      { match: 'hardcore',   label: 'Hardcore Officers' },
      { match: 'robocop',    label: 'Robocop' },
    ],
  },
  {
    id: 'ron-no-mercy',
    gameId: 'readyornot',
    nexusModId: 2208,
    displayName: 'No Mercy for Terrorists',
    variants: [
      { match: 'standard',        label: 'Standard' },
      { match: 'justified kills', label: 'Justified Kills' },
      { match: 'wanted',          label: 'WANTED' },
    ],
  },

  // -----------------------------------------------------------------
  // Ready or Not — cross-mod conflict groups
  // (separate Nexus pages covering the same feature)
  // -----------------------------------------------------------------
  {
    id: 'ron-player-health',
    gameId: 'readyornot',
    displayName: 'Player Health',
    variants: [
      { match: 'hp plus',       label: 'HP PLUS' },
      { match: 'hp edit',       label: 'HP Edit' },
      { match: '350hp',         label: '350 HP Mod' },
      { match: '1000hp',        label: '1000 HP Mod' },
      { match: '1000 health',   label: '1000 Health' },
      { match: 'player health', label: 'Player Health' },
      { match: 'lesshp',        label: 'Less HP' },
      { match: 'health nerf',   label: 'Health Nerf' },
      { match: 'health buff',   label: 'Health Buff' },
    ],
  },
];

module.exports = { VARIANT_GROUPS };

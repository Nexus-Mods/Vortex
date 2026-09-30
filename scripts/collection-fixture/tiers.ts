/**
 * Setup sizes to benchmark, from the "Representative Vortex User Setup" benchmark specification
 * (Vortex client load-order reports, 30 days to 29 Sep 2026, latest report per client instance,
 * Skyrim Special Edition). Refresh these when the specification is refreshed.
 *
 * `total` and `enabled` are separate percentiles in the source, so the gap between them is only an
 * approximate disabled count. The source has no enabled figure at p99; the stress tier uses the
 * observed average enabled share instead.
 */

export type TierId = "light" | "typical" | "heavy" | "power" | "stress";

export interface ITier {
  id: TierId;
  percentile: string;
  total: number;
  enabled: number;
  role: string;
}

/** average share of installed mods that are enabled (86.6% on Skyrim SE, 86.9% across games) */
export const ENABLED_RATIO = 0.87;

export const TIERS: Record<TierId, ITier> = {
  light: { id: "light", percentile: "p25", total: 47, enabled: 33, role: "new or casual user" },
  typical: { id: "typical", percentile: "p50", total: 150, enabled: 117, role: "average user" },
  heavy: { id: "heavy", percentile: "p75", total: 570, enabled: 555, role: "heavy user" },
  power: { id: "power", percentile: "p90", total: 1594, enabled: 1221, role: "power user" },
  stress: {
    id: "stress",
    percentile: "p99",
    total: 2685,
    enabled: Math.round(2685 * ENABLED_RATIO),
    role: "upper limit",
  },
};

export const TIER_IDS: TierId[] = ["light", "typical", "heavy", "power", "stress"];

export function isTierId(value: string): value is TierId {
  return TIER_IDS.some((id) => id === value);
}

/**
 * Share of a tier's mods that belong to the collection; the rest model mods the user installed
 * outside it. The telemetry cannot say how many mods came from a collection, so this is a
 * judgement call, and --collection-share overrides it.
 */
export const DEFAULT_COLLECTION_SHARE = 0.8;

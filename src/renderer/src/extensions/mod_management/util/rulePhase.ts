/**
 * Maps a collection install rule to the install-ordering phase it runs in. Required rules use their
 * authored phase (bridging the first-class and legacy locations); optional (recommends) members map
 * to the trailing OPTIONAL_PHASE so they install last as a single dedicated group.
 */

import type { IModRule } from "../types/IMod";
import { isDependencyRule } from "./testModReference";

/**
 * Install phase reserved for optional (recommends) members. It sorts after every authored
 * required phase, so optionals install in one dedicated phase at the very end through the normal
 * phase machinery. Comfortably above any authored phase; phase-backfill loops iterate the real
 * phase set rather than 0..phase so this value never drives an enumeration.
 */
export const OPTIONAL_PHASE = 666;

/**
 * The install-ordering phase a rule belongs to. Optional (recommends) members always map to the
 * dedicated OPTIONAL_PHASE regardless of their authored phase, so they run last as a group. For
 * required rules, `phase` is a first-class IModRule field, but older rules stored it under
 * `extra.phase`; this is the single place that bridges the two locations (mirroring ruleInstallSpec
 * for patches), so callers never have to know about the legacy location. Defaults to phase 0.
 */
export function rulePhase(rule: IModRule | undefined): number {
  if (rule?.type === "recommends") {
    return OPTIONAL_PHASE;
  }
  return rule?.phase ?? (rule?.extra?.["phase"] as number | undefined) ?? 0;
}

/**
 * The distinct install phases a collection's dependency rules use, ascending (optionals contribute
 * the single OPTIONAL_PHASE). The phase engine backfills "earlier phases finished" from this real
 * set instead of enumerating integers 0..phase, which would run up to the OPTIONAL_PHASE sentinel
 * and pollute its bookkeeping with phantom phases.
 */
export function collectionRulePhases(rules: IModRule[]): number[] {
  const phases = new Set<number>();
  (rules ?? []).filter(isDependencyRule).forEach((rule) => phases.add(rulePhase(rule)));
  return Array.from(phases).sort((a, b) => a - b);
}

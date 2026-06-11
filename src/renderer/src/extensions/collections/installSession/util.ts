import type { IModRule } from "../../mod_management/types/IMod";
import type { CollectionModStatus } from "./types";

export function generateCollectionSessionId(collectionId: string, profileId: string): string {
  if (!profileId || !collectionId) {
    return null;
  }
  return `${collectionId}_${profileId}`;
}

export function modRuleId(input: IModRule): string {
  return (
    input.type +
    "_" +
    (input.reference.tag ||
      input.reference.fileMD5 ||
      input.reference.id ||
      input.reference.logicalFileName ||
      input.reference.fileExpression ||
      input.reference.description)
  );
}

/**
 * Determine the status of a required collection rule when the install session is
 * (re)built. The session lives in state.session and is NOT persisted, so on a
 * mid-install restart it is reconstructed from inputs that DO survive: the set of
 * installed mods, present downloads, and the rule's durable `ignored` flag. The
 * `ignored` flag is written whenever the user skips a mod (see
 * InstallDriver.markRuleIgnored), so a skipped required mod rehydrates as the
 * terminal "ignored" status rather than reverting to "pending" (which would leave
 * the collection permanently incomplete after a restart).
 *
 * `ignored` takes precedence over `installed` to preserve the prior behaviour: a
 * mod the user chose to skip stays skipped even if a copy happens to be installed.
 */
export function reconstructModStatus(
  rule: IModRule,
  isInstalled: boolean,
  isDownloaded: boolean,
): CollectionModStatus {
  if (rule.ignored === true) {
    return "ignored";
  }
  if (isInstalled) {
    return "installed";
  }
  if (isDownloaded) {
    return "downloaded";
  }
  return "pending";
}

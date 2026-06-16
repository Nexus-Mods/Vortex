import type { IDownload } from "../../download_management/types/IDownload";
import type { IMod, IModRule } from "../../mod_management/types/IMod";
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
 * Infer the status of a collection rule from persistent state: the installed mod (if
 * any), the rule's download (if any), and the rule's durable `ignored` flag. Used both
 * to (re)build the install session - which lives in state.session and is NOT persisted,
 * so on a mid-install restart it must be reconstructed from inputs that DO survive - and
 * to derive a row's status when no session is tracking it.
 *
 * Precedence:
 * - `ignored` wins over everything: a mod the user chose to skip stays skipped even if a
 *   copy happens to be installed/downloaded, and rehydrates as terminal "ignored" rather
 *   than reverting to "pending" (which would leave the collection permanently incomplete).
 * - a present mod reports its own lifecycle state (its ModState maps onto the shared
 *   statuses), so a mid-install mod is "installing", not "installed", until the install
 *   actually completes.
 * - an unfinished download is "downloading", a finished (or bundled) one "downloaded".
 */
export function reconstructModStatus(
  rule: IModRule,
  mod: IMod | undefined,
  download: IDownload | undefined,
): CollectionModStatus {
  if (rule.ignored === true) {
    return "ignored";
  }
  if (mod !== undefined) {
    return mod.state ?? "installed";
  }
  if (download !== undefined) {
    return download.state === "finished" ? "downloaded" : "downloading";
  }
  // bundled mods ship inside the collection archive, so they count as downloaded
  // even without a separate download entry
  if (rule.extra?.localPath != null) {
    return "downloaded";
  }
  return "pending";
}

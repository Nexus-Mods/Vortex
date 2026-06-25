import type { IDownload } from "../extensions/download_management/types/IDownload";
import type { IMod, IModReference, IModRule } from "../extensions/mod_management/types/IMod";
import type {
  CollectionModStatus,
  ICollectionInstallSession,
} from "../types/collections/ICollectionInstallSession";

/**
 * The terminal member statuses: a member with one of these has a decided outcome and no longer
 * blocks collection completion. "failed" is terminal because InstallManager writes it only after
 * retries are exhausted (in-flight retries keep a non-terminal status, so they still block);
 * "ignored" is an excluded member (a user skip or the durable ignored flag). "optional"
 * (optional-not-selected) is intentionally NOT terminal. Shared so the driver's completion
 * decision, the install-progress selector, and InstallManager's completion counter stay in sync.
 */
export function isTerminalMemberStatus(status: CollectionModStatus): boolean {
  return status === "installed" || status === "failed" || status === "ignored";
}

/**
 * Progress position for the free-user "download mod" dialog: the count of members whose download
 * has been resolved (anything other than still-pending or in-flight `downloading`), plus one for
 * the download currently shown, clamped to the total. Counting resolved members (so a skip
 * advances the position) keeps it monotonic and inside 1..total.
 */
export function freeUserDownloadPosition(session: ICollectionInstallSession): {
  position: number;
  total: number;
} {
  const total = Math.max(session.totalRequired + session.totalOptional, 1);
  const resolved = Object.values(session.mods).filter(
    (mod) => mod.status !== "pending" && mod.status !== "downloading",
  ).length;
  return { position: Math.min(resolved + 1, total), total };
}

export function generateCollectionSessionId(collectionId: string, profileId: string): string {
  if (!profileId || !collectionId) {
    return null;
  }
  return `${collectionId}_${profileId}`;
}

/**
 * Stable identity of a mod reference: the rule's tag if present, else the first available
 * content identifier. This is the reference half of modRuleId, shared so that matching a
 * dependency back to its session rule uses the exact same notion of identity as the key.
 */
export function referenceId(reference: IModReference): string | undefined {
  return (
    reference.tag ||
    reference.fileMD5 ||
    reference.id ||
    reference.logicalFileName ||
    reference.fileExpression ||
    reference.description
  );
}

export function modRuleId(input: IModRule): string {
  return input.type + "_" + referenceId(input.reference);
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

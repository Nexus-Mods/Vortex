/**
 * Which session members a requeue pass should hand back to the installer - the DECISION, kept pure
 * and apart from the side effects in reQueueDownloadedMods (which starts the installs it queues,
 * leaving nothing queued to inspect). Mirrors how the driver separates isInstallComplete from
 * finalizeInstalledCollection.
 */
import type { ICollectionModInstallInfo } from "../../../types/collections/ICollectionInstallSession";
import type { IModReference } from "../types/IMod";

/** A session member selected for requeue, with the finished download that backs it. */
export type IRequeueCandidate = ICollectionModInstallInfo & { downloadId: string };

/**
 * Members at "downloaded" - archive present, nothing installing them - that are backed by a
 * resolvable download and belong to a phase at or before the one being processed.
 *
 * The phase bound keeps optionals in their lane: `recommends` members sit at OPTIONAL_PHASE, so they
 * become eligible only once the gate reaches it, never while a required phase runs. Whether the gate
 * can reach OPTIONAL_PHASE is InstallPhaseTracker's concern, not this filter's.
 *
 * `resolveDownloadId` is injected so the download-matching heuristics stay with the caller and this
 * selection needs no redux state.
 */
export function selectRequeueCandidates(
  members: ICollectionModInstallInfo[],
  currentPhase: number,
  resolveDownloadId: (reference: IModReference) => string | null,
): IRequeueCandidate[] {
  return members.flatMap((member) => {
    // "pending" members are deliberately excluded - they are already queued for installation. Both
    // cheap tests run before resolveDownloadId, which scans every download.
    if (member?.status !== "downloaded" || (member.phase ?? 0) > currentPhase) {
      return [];
    }
    const downloadId = member.rule?.reference ? resolveDownloadId(member.rule.reference) : null;
    return downloadId != null ? [{ ...member, downloadId }] : [];
  });
}

import type { DownloadState, IDownload } from "@/extensions/download_management/types/IDownload";
import { downloadIdsByTag } from "@/extensions/mod_management/util/testModReference";
import type {
  CollectionModStatus,
  ICollectionInstallSession,
} from "@/types/collections/ICollectionInstallSession";

const ACTIVE_DOWNLOAD_STATES: DownloadState[] = ["init", "started", "finalizing"];

/** Members that are not part of what the collection still has to download. */
const EXCLUDED_MEMBER_STATUSES: CollectionModStatus[] = ["failed", "ignored", "optional"];

/** Members whose archive is already on disk. */
const DOWNLOADED_MEMBER_STATUSES: CollectionModStatus[] = ["downloaded", "installing", "installed"];

export interface IByteProgress {
  received: number;
  total: number;
  /** The downloads in flight, which the ring's figures and the flyout cover. */
  activeIds: string[];
  pausedIds: string[];
}

const NO_MEMBERS: ReadonlySet<string> = new Set();

/**
 * Rule ids of the members whose archive is already on disk. Taken when an install starts, so
 * an update or a resumed install measures only what it has left to download.
 */
export const downloadedMemberIds = (session: ICollectionInstallSession): ReadonlySet<string> =>
  new Set(
    Object.entries(session.mods ?? {})
      .filter(([, member]) => DOWNLOADED_MEMBER_STATUSES.includes(member.status))
      .map(([ruleId]) => ruleId),
  );

/**
 * The bytes the spine's download ring reports, and the downloads in flight.
 *
 * Without a collection installing, the bytes are every active or paused download. While one is
 * installing, the collection's selected members count with their expected size, so the ring
 * tracks the whole collection rather than resetting as each member's download completes.
 * Members in `alreadyDownloaded` (see `downloadedMemberIds`) are left out. Downloads that
 * aren't one of the counted members are added on top.
 */
export const downloadByteProgress = (
  files: Record<string, IDownload>,
  session: ICollectionInstallSession | undefined,
  alreadyDownloaded: ReadonlySet<string> = NO_MEMBERS,
): IByteProgress => {
  let received = 0;
  let total = 0;
  const claimed = new Set<string>();

  if (session !== undefined) {
    const byTag = downloadIdsByTag(files);

    for (const [ruleId, member] of Object.entries(session.mods ?? {})) {
      if (alreadyDownloaded.has(ruleId)) {
        continue;
      }

      const tag = member.rule?.reference?.tag;
      const downloadId = tag === undefined ? undefined : byTag.get(tag);
      const download = downloadId === undefined ? undefined : files[downloadId];

      // One archive can satisfy several members; it counts once, under the first.
      if (downloadId !== undefined && claimed.has(downloadId)) {
        continue;
      }

      const isDone =
        DOWNLOADED_MEMBER_STATUSES.includes(member.status) || download?.state === "finished";

      // A failed download counts as done at the bytes it got, so the ring doesn't go backwards
      // when a member fails. The session keeps such a member on "downloading", so the download
      // decides. A retry is a new download, which takes over the member's tag.
      if (!isDone && downloadId !== undefined && download?.state === "failed") {
        claimed.add(downloadId);
        total += download.received;
        received += download.received;
        continue;
      }

      if (EXCLUDED_MEMBER_STATUSES.includes(member.status)) {
        continue;
      }

      const size = Math.max(
        member.rule?.reference?.fileSize ?? 0,
        download?.size ?? 0,
        download?.received ?? 0,
      );
      if (size === 0) {
        continue;
      }

      if (downloadId !== undefined) {
        claimed.add(downloadId);
      }
      total += size;
      received += isDone ? size : (download?.received ?? 0);
    }
  }

  const activeIds: string[] = [];
  const pausedIds: string[] = [];
  for (const [id, download] of Object.entries(files)) {
    if (ACTIVE_DOWNLOAD_STATES.includes(download.state)) {
      activeIds.push(id);
    } else if (download.state === "paused") {
      pausedIds.push(id);
    } else {
      continue;
    }
    if (!claimed.has(id)) {
      total += Math.max(1, download.size ?? 0, download.received);
      received += download.received;
    }
  }

  return { received, total, activeIds, pausedIds };
};

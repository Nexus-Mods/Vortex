import type { DownloadState, IDownload } from "@/extensions/download_management/types/IDownload";
import { downloadReferenceTags } from "@/extensions/mod_management/util/testModReference";
import type {
  CollectionModStatus,
  ICollectionInstallSession,
} from "@/types/collections/ICollectionInstallSession";

export const ACTIVE_DOWNLOAD_STATES: DownloadState[] = ["init", "started", "finalizing"];

/** Members that are not part of what the collection still has to download. */
const EXCLUDED_MEMBER_STATUSES: CollectionModStatus[] = ["failed", "ignored", "optional"];

/** Members whose archive is already on disk. */
const DOWNLOADED_MEMBER_STATUSES: CollectionModStatus[] = ["downloaded", "installing", "installed"];

export interface IByteProgress {
  received: number;
  total: number;
}

const isInFlight = (download: IDownload): boolean =>
  ACTIVE_DOWNLOAD_STATES.includes(download.state) || download.state === "paused";

const NO_MEMBERS: ReadonlySet<string> = new Set();

/**
 * Download ids by every reference tag they carry. The first download wins a shared tag, except
 * that a failed one gives way: a retry is a new download carrying the same tag.
 */
const downloadIdsByTag = (files: Record<string, IDownload>): Map<string, string> => {
  const byTag = new Map<string, string>();
  for (const [id, download] of Object.entries(files)) {
    for (const tag of downloadReferenceTags(download)) {
      const current = byTag.get(tag);
      if (
        current === undefined ||
        (files[current].state === "failed" && download.state !== "failed")
      ) {
        byTag.set(tag, id);
      }
    }
  }
  return byTag;
};

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
 * The bytes the spine's download ring reports.
 *
 * Without a collection installing, that is every active or paused download. While one is
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
      if (alreadyDownloaded.has(ruleId) || EXCLUDED_MEMBER_STATUSES.includes(member.status)) {
        continue;
      }

      const tag = member.rule?.reference?.tag;
      const downloadId = tag === undefined ? undefined : byTag.get(tag);
      const download = downloadId === undefined ? undefined : files[downloadId];

      const isDone =
        DOWNLOADED_MEMBER_STATUSES.includes(member.status) || download?.state === "finished";

      // The session keeps a failed download's member on "downloading", so the download decides.
      if (!isDone && download?.state === "failed") {
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

  for (const [id, download] of Object.entries(files)) {
    if (claimed.has(id) || !isInFlight(download)) {
      continue;
    }
    total += Math.max(1, download.size ?? 0, download.received);
    received += download.received;
  }

  return { received, total };
};

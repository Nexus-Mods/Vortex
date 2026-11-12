import { useMemo, useState } from "react";
import { useSelector } from "react-redux";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IState } from "@/types/IState";
import { getCollectionActiveSession } from "@/util/collectionInstallSessionSelectors";

import {
  downloadByteProgress,
  downloadedMemberIds,
} from "./download_byte_progress/downloadByteProgress";

interface IInstallBaseline {
  sessionId: string;
  alreadyDownloaded: ReadonlySet<string>;
}

/** Stable, so a store without downloads doesn't churn the memo. */
const NO_FILES: Record<string, IDownload> = {};

export interface IDownloadProgress {
  /** The active downloads, then the paused: everything the figures below cover. */
  activeIds: string[];
  estimatedMins: number;
  isDownloading: boolean;
  isPaused: boolean;
  progress: number;
  speedMBps: number;
}

const selectDownloadFiles = (state: IState) => state.persistent.downloads?.files;
const selectDownloadSpeed = (state: IState) => state.persistent.downloads?.speed ?? 0;

/**
 * Aggregate progress over everything currently downloading, for the spine's download
 * button and its flyout. While a collection installs, the byte figures cover the whole
 * collection (see `downloadByteProgress`), so the ring doesn't reset per member.
 *
 * The slices are subscribed separately and combined here because a selector returning a
 * fresh object re-renders on every dispatch, and the download adapter dispatches batched
 * progress about once a second per download.
 */
export const useDownloadProgress = (): IDownloadProgress => {
  const files = useSelector(selectDownloadFiles) ?? NO_FILES;
  const speed = useSelector(selectDownloadSpeed);
  const session = useSelector(getCollectionActiveSession);

  // The members already downloaded when this install started, taken once per install so an
  // update or a resumed install measures only what it has left. The session id is the same
  // for every install of a collection into a profile, so the baseline is dropped when the
  // session ends rather than compared by id alone.
  const toBaseline = (): IInstallBaseline | undefined =>
    session === undefined
      ? undefined
      : { sessionId: session.sessionId, alreadyDownloaded: downloadedMemberIds(session) };
  const [baseline, setBaseline] = useState(toBaseline);
  if (baseline?.sessionId !== session?.sessionId) {
    setBaseline(toBaseline());
  }
  const alreadyDownloaded = baseline?.alreadyDownloaded;

  return useMemo(() => {
    const { received, total, activeIds, pausedIds } = downloadByteProgress(
      files,
      session,
      alreadyDownloaded,
    );
    const remainingBytes = total - received;

    // A collection with mods left to download keeps the ring up between downloads (free users
    // start each one by hand), rather than flicking back to the icon each time.
    if (activeIds.length === 0 && pausedIds.length === 0 && remainingBytes <= 0) {
      return {
        activeIds: [],
        estimatedMins: 0,
        isDownloading: false,
        isPaused: false,
        progress: 0,
        speedMBps: 0,
      };
    }

    // The download adapter's last speed report, sent as the final download ends, is usually
    // non-zero and nothing replaces it until bytes move again, so it's stale between downloads.
    const currentSpeed = activeIds.length > 0 ? speed : 0;

    return {
      // Paused downloads still have received bytes to report.
      activeIds: [...activeIds, ...pausedIds],
      estimatedMins: currentSpeed > 0 ? remainingBytes / currentSpeed / 60 : 0,
      isDownloading: true,
      isPaused: activeIds.length === 0 && pausedIds.length > 0,
      progress: total > 0 ? (received * 100) / total : 0,
      speedMBps: currentSpeed / (1024 * 1024),
    };
  }, [alreadyDownloaded, files, session, speed]);
};

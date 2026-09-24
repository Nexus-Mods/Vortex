import { useMemo } from "react";
import { useSelector } from "react-redux";

import type { DownloadState, IDownload } from "@/extensions/download_management/types/IDownload";
import type { IState } from "@/types/IState";

const ACTIVE_DOWNLOAD_STATES: DownloadState[] = ["init", "started", "finalizing"];

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
 * button and its flyout.
 *
 * The slices are subscribed separately and combined here because a selector returning a
 * fresh object re-renders on every dispatch, and the download adapter dispatches batched
 * progress about once a second per download.
 */
export const useDownloadProgress = (): IDownloadProgress => {
  const files = useSelector(selectDownloadFiles) ?? NO_FILES;
  const speed = useSelector(selectDownloadSpeed);

  return useMemo(() => {
    const allDownloads = Object.entries(files);

    const active = allDownloads.filter(([, dl]) => ACTIVE_DOWNLOAD_STATES.includes(dl.state));
    const paused = allDownloads.filter(([, dl]) => dl.state === "paused");

    if (active.length === 0 && paused.length === 0) {
      return {
        activeIds: [],
        estimatedMins: 0,
        isDownloading: false,
        isPaused: false,
        progress: 0,
        speedMBps: 0,
      };
    }

    // Paused downloads still have received bytes to report.
    const relevant = [...active, ...paused];

    const totalSize = relevant.reduce(
      (sum, [, dl]) => sum + Math.max(1, dl.size ?? 0, dl.received),
      0,
    );
    const totalReceived = relevant.reduce((sum, [, dl]) => sum + dl.received, 0);
    const remainingBytes = totalSize - totalReceived;

    return {
      activeIds: relevant.map(([id]) => id),
      estimatedMins: speed > 0 ? remainingBytes / speed / 60 : 0,
      isDownloading: true,
      isPaused: active.length === 0,
      progress: totalSize > 0 ? (totalReceived * 100) / totalSize : 0,
      speedMBps: speed / (1024 * 1024),
    };
  }, [files, speed]);
};

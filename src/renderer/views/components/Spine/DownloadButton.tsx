import { mdiDownload } from "@mdi/js";
import React, { type FC } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { DownloadState } from "../../../../extensions/download_management/types/IDownload";
import type { IState } from "../../../../types/IState";

import { setOpenMainPage } from "../../../../actions/session";
import { Icon } from "../../../../tailwind/components/next/icon";
import { Typography } from "../../../../tailwind/components/next/typography";
import { joinClasses } from "../../../../tailwind/components/next/utils";
import { useSpineContext } from "./SpineContext";

const ACTIVE_DOWNLOAD_STATES: DownloadState[] = [
  "init",
  "started",
  "finalizing",
];

interface DownloadProgress {
  isDownloading: boolean;
  isPaused: boolean;
  progress: number; // 0-100
  speedMBps: number; // Speed in MB/s
  estimatedMins: number; // Estimated time remaining in minutes
}

function useDownloadProgress(): DownloadProgress {
  return useSelector((state: IState) => {
    const files = state.persistent.downloads?.files ?? {};
    const speed = state.persistent.downloads?.speed ?? 0;
    const allDownloads = Object.values(files);

    const activeDownloads = allDownloads.filter((dl) =>
      ACTIVE_DOWNLOAD_STATES.includes(dl.state),
    );
    const pausedDownloads = allDownloads.filter((dl) => dl.state === "paused");

    // If there are no active or paused downloads, nothing is happening
    if (activeDownloads.length === 0 && pausedDownloads.length === 0) {
      return {
        isDownloading: false,
        isPaused: false,
        progress: 0,
        speedMBps: 0,
        estimatedMins: 0,
      };
    }

    // Combine active and paused downloads for progress calculation
    const relevantDownloads = [...activeDownloads, ...pausedDownloads];

    const totalSize = relevantDownloads.reduce(
      (sum, dl) => sum + Math.max(1, dl.size ?? 0, dl.received),
      0,
    );
    const totalReceived = relevantDownloads.reduce(
      (sum, dl) => sum + dl.received,
      0,
    );

    const progress = totalSize > 0 ? (totalReceived * 100) / totalSize : 0;

    // isPaused: true only if ALL downloads are paused (none actively downloading)
    const isPaused = activeDownloads.length === 0 && pausedDownloads.length > 0;

    // Speed in MB/s (speed from state is in bytes/s)
    const speedMBps = speed / (1024 * 1024);

    // Estimated time remaining in minutes
    const remainingBytes = totalSize - totalReceived;
    const estimatedMins = speed > 0 ? remainingBytes / speed / 60 : 0;

    return {
      isDownloading: true,
      isPaused,
      progress,
      speedMBps,
      estimatedMins,
    };
  });
}

const ProgressRing: FC<{
  isActive: boolean;
  isPaused: boolean;
  progress: number;
}> = ({ isActive, isPaused, progress }) => {
  const size = 48;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg
      className="pointer-events-none absolute inset-0 -rotate-90"
      height={size}
      width={size}
    >
      {/* Background circle */}
      <circle
        className="stroke-stroke-weak"
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={radius}
        strokeWidth={strokeWidth}
      />

      {/* Progress circle */}
      <circle
        className={joinClasses([
          "transition-colors",
          isActive
            ? "stroke-neutral-strong"
            : isPaused
              ? "stroke-neutral-moderate"
              : "stroke-info-subdued group-hover/download:stroke-info-strong",
        ])}
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
};

export const DownloadButton: FC = () => {
  const dispatch = useDispatch();
  const { selection } = useSpineContext();

  const mainPage = useSelector((state: IState) => state.session.base.mainPage);
  const targetPage = selection.type === "game" ? "game-downloads" : "Downloads";
  const isActive = mainPage === targetPage;

  const { isDownloading, isPaused, progress, speedMBps, estimatedMins } =
    useDownloadProgress();

  // TODO: Add mechanism to toggle between speed and time display
  const isTime = false;

  return (
    <button
      className={joinClasses(
        [
          "group/download relative flex size-12 shrink-0 flex-col items-center justify-center gap-y-0.5 rounded-full transition-colors",
          "hover:bg-surface-translucent-high",
          isPaused || isDownloading
            ? ""
            : isActive
              ? "border-2 border-neutral-strong"
              : "border-2 border-stroke-weak hover:border-neutral-strong",
        ],
        { "bg-surface-translucent-low": isActive },
      )}
      title="Downloads"
      onClick={() => dispatch(setOpenMainPage(targetPage, false))}
    >
      {isPaused || isDownloading ? (
        <>
          {!isPaused && (
            <Typography
              appearance="none"
              as="span"
              className="leading-none font-semibold"
              type="body-sm"
            >
              {isTime ? Math.ceil(estimatedMins) : speedMBps.toFixed(1)}
            </Typography>
          )}

          <span className="text-[0.375rem] leading-none tracking-[1px] uppercase">
            {isPaused ? "paused" : isTime ? "mins" : "mb/s"}
          </span>

          <ProgressRing
            isActive={isActive}
            isPaused={isPaused}
            progress={progress}
          />
        </>
      ) : (
        <Icon className="transition-colors" path={mdiDownload} size="lg" />
      )}
    </button>
  );
};

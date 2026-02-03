import { mdiDownload } from "@mdi/js";
import React, { type FC, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { DownloadState } from "../../../../extensions/download_management/types/IDownload";
import type { IState } from "../../../../types/IState";

import { setOpenMainPage } from "../../../../actions/session";
import { Icon } from "../../../../tailwind/components/next/icon";
import { Typography } from "../../../../tailwind/components/next/typography";
import { joinClasses } from "../../../../tailwind/components/next/utils";
import { SpineButton } from "./SpineButton";

const ACTIVE_DOWNLOAD_STATES: DownloadState[] = [
  "init",
  "started",
  "finalizing",
];

interface DownloadProgress {
  isDownloading: boolean;
  progress: number; // 0-100
}

function useDownloadProgress(): DownloadProgress {
  return useSelector((state: IState) => {
    const files = state.persistent.downloads?.files ?? {};
    const activeDownloads = Object.values(files).filter((dl) =>
      ACTIVE_DOWNLOAD_STATES.includes(dl.state),
    );

    if (activeDownloads.length === 0) {
      return { isDownloading: false, progress: 0 };
    }

    const totalSize = activeDownloads.reduce(
      (sum, dl) => sum + Math.max(1, dl.size ?? 0, dl.received),
      0,
    );
    const totalReceived = activeDownloads.reduce(
      (sum, dl) => sum + dl.received,
      0,
    );

    const progress = totalSize > 0 ? (totalReceived * 100) / totalSize : 0;

    return { isDownloading: true, progress };
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

  const mainPage = useSelector((state: IState) => state.session.base.mainPage);
  const isActive = mainPage === "Downloads";

  // const { isDownloading, progress } = useDownloadProgress();

  const [isDownloading, setIsDownloading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTime, setIsTime] = useState(false);
  const progress = 33;

  return (
    <div className="flex flex-col gap-y-1">
      <button onClick={() => setIsDownloading((prev) => !prev)}>
        Downloading: {isDownloading ? "✔" : "✖"}
      </button>

      <button onClick={() => setIsPaused((prev) => !prev)}>
        Paused: {isPaused ? "✔" : "✖"}
      </button>

      <button onClick={() => setIsTime((prev) => !prev)}>
        Time: {isTime ? "✔" : "✖"}
      </button>

      <button
        className={joinClasses(
          [
            "group/download relative flex size-12 flex-col items-center justify-center gap-y-0.5 rounded-full transition-colors",
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
        onClick={() => dispatch(setOpenMainPage("Downloads", false))}
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
                {isTime ? 48 : 8.6}
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
    </div>
  );
};

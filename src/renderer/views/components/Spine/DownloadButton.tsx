import { mdiDownload } from "@mdi/js";
import React, { type FC } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { DownloadState } from "../../../../extensions/download_management/types/IDownload";
import type { IState } from "../../../../types/IState";

import { setOpenMainPage } from "../../../../actions/session";
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

interface ProgressRingProps {
  progress: number; // 0-100
  size: number;
  strokeWidth: number;
}

const ProgressRing: FC<ProgressRingProps> = ({
  progress,
  size,
  strokeWidth,
}) => {
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
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={radius}
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={strokeWidth}
      />

      {/* Progress circle */}
      <circle
        className="transition-[stroke-dashoffset] duration-300"
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={radius}
        stroke="var(--color-accent-brand, #da8e35)"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
};

export const DownloadButton: FC = () => {
  const dispatch = useDispatch();

  const mainPage = useSelector((state: IState) => state.session.base.mainPage);
  const { isDownloading, progress } = useDownloadProgress();

  return (
    <div className="relative size-12">
      <SpineButton
        className="rounded-full border-2 text-neutral-strong"
        iconPath={mdiDownload}
        isActive={mainPage === "Downloads"}
        title="Downloads"
        onClick={() => dispatch(setOpenMainPage("Downloads", false))}
      />

      {isDownloading && (
        <ProgressRing progress={progress} size={48} strokeWidth={3} />
      )}
    </div>
  );
};

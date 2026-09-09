import { mdiDownload, mdiDownloadOutline } from "@mdi/js";
import React, { type ReactNode, useMemo } from "react";
import { useSelector } from "react-redux";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IState } from "@/types/IState";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { XOr } from "@/ui/utils/types";

import { SpineButton } from "../SpineButton";
import { useSpineContext } from "../SpineContext";
import { DownloadFlyout } from "./DownloadFlyout";
import { useDownloadEta } from "./useDownloadEta.hook";
import { useDownloadFlyout } from "./useDownloadFlyout.hook";
import { useDownloadProgress } from "./useDownloadProgress.hook";

/** Serves as both the button's accessible name and its resting tooltip. */
const LABEL = "Downloads";

const selectDownload =
  (id: string | undefined) =>
  (state: IState): IDownload | undefined =>
    id === undefined ? undefined : state.persistent.downloads?.files?.[id];

const ProgressRing = ({
  isActive,
  isPaused,
  progress,
}: {
  isActive: boolean;
  isPaused: boolean;
  progress: number;
}) => {
  const size = 48;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg
      className="pointer-events-none absolute top-1/2 left-1/2 -translate-1/2 -rotate-90"
      height={size}
      width={size}
    >
      {/* Background circle */}
      <circle
        className={joinClasses([
          "transition-colors",
          isActive ? "stroke-stroke-moderate" : "stroke-stroke-weak",
        ])}
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
              ? "stroke-stroke-moderate"
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

export const DownloadButton = () => {
  const { selection, selectDownloads } = useSpineContext();

  const isActive = selection.type === "downloads";

  const { activeIds, estimatedMins, isDownloading, isPaused, progress, speedMBps } =
    useDownloadProgress();

  const { downloadId, isAnnouncing, isOpen, onOpenChange, onTriggerEnter, onTriggerLeave } =
    useDownloadFlyout(activeIds);

  const selectNamed = useMemo(() => selectDownload(downloadId), [downloadId]);
  const download = useSelector(selectNamed);

  // Sampled out here rather than in the flyout: the panel unmounts when it closes, so the
  // rate would start from nothing every time the user brought it back.
  const eta = useDownloadEta(download);

  // TODO: Add mechanism to toggle between speed and time display
  const isTime = false;

  const showProgress = isPaused || isDownloading;

  const body: XOr<{ content: string }, { customContent: ReactNode }> =
    downloadId === undefined
      ? { content: LABEL }
      : {
          customContent: (
            <DownloadFlyout
              download={download}
              eta={eta}
              otherCount={Math.max(0, activeIds.length - 1)}
            />
          ),
        };

  return (
    <Tooltip
      {...body}
      className={!!downloadId && "w-80"}
      open={isOpen}
      persistent={isAnnouncing}
      placement="right"
      onOpenChange={onOpenChange}
    >
      <SpineButton
        isCircular
        tooltipDisabled
        border={showProgress ? "none" : "visible"}
        className="group/download flex-col gap-y-0.5"
        iconPath={!showProgress && (isActive ? mdiDownload : mdiDownloadOutline)}
        isActive={isActive}
        title={LABEL}
        onClick={() => selectDownloads()}
        onMouseEnter={onTriggerEnter}
        onMouseLeave={onTriggerLeave}
      >
        {showProgress && (
          <>
            {!isPaused && (
              <Typography
                as="span"
                brand="none"
                className="relative z-1 leading-none font-semibold text-shadow-halo text-shadow-translucent-dark-100"
                type="body-sm"
              >
                {isTime ? Math.ceil(estimatedMins) : speedMBps.toFixed(1)}
              </Typography>
            )}

            <span className="relative z-1 text-[0.375rem] leading-none tracking-[1px] uppercase">
              {isPaused ? "paused" : isTime ? "mins" : "mb/s"}
            </span>

            <ProgressRing isActive={isActive} isPaused={isPaused} progress={progress} />
          </>
        )}
      </SpineButton>
    </Tooltip>
  );
};

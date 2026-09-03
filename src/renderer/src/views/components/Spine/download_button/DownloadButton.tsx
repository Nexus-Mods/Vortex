import { Transition } from "@headlessui/react";
import { mdiDownload, mdiDownloadOutline } from "@mdi/js";
import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import type { DownloadState } from "@/extensions/download_management/types/IDownload";
import type { IState } from "@/types/IState";
import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

import { SpineButton } from "../SpineButton";
import { useSpineContext } from "../SpineContext";

const ACTIVE_DOWNLOAD_STATES: DownloadState[] = ["init", "started", "finalizing"];

const useArrowShown = (hasProgress: boolean) => {
  const [isShown, setIsShown] = useState(!hasProgress);

  useEffect(() => {
    if (hasProgress) {
      setIsShown(false);
    }
  }, [hasProgress]);

  return [isShown, () => setIsShown(true)] as const;
};

interface DownloadProgress {
  isDownloading: boolean;
  isPaused: boolean;
  progress: number; // 0-100
  speedMBps: number; // Speed in MB/s
  estimatedMins: number; // Estimated time remaining in minutes
}

const useDownloadProgress = (): DownloadProgress => {
  return useSelector((state: IState) => {
    const files = state.persistent.downloads?.files ?? {};
    const speed = state.persistent.downloads?.speed ?? 0;
    const allDownloads = Object.values(files);

    const activeDownloads = allDownloads.filter((dl) => ACTIVE_DOWNLOAD_STATES.includes(dl.state));
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
    const totalReceived = relevantDownloads.reduce((sum, dl) => sum + dl.received, 0);

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
};

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

  const { isDownloading, isPaused, progress, speedMBps, estimatedMins } = useDownloadProgress();

  // TODO: Add mechanism to toggle between speed and time display
  const isTime = false;

  // A queued download is already `init`, which counts as running, so the whole of a
  // collection's queue holds the button rather than each of its files taking a turn.
  const isRunning = isPaused || isDownloading;
  const [isArrowShown, showArrow] = useArrowShown(isRunning);

  // The last live figures, so the fade out at the end shows what was there rather than
  // the zeroes an empty queue reports.
  const shownRef = useRef<{ progress: number; unit: string; value?: string }>({
    progress: 0,
    unit: "",
  });

  if (isRunning) {
    shownRef.current = {
      progress,
      unit: isPaused ? "paused" : isTime ? "mins" : "mb/s",
      value: isPaused
        ? undefined
        : isTime
          ? String(Math.ceil(estimatedMins))
          : speedMBps.toFixed(1),
    };
  }

  const shown = shownRef.current;

  return (
    <SpineButton
      isCircular
      border={isRunning ? "none" : "visible"}
      className="group/download flex-col gap-y-0.5"
      isActive={isActive}
      title="Downloads"
      onClick={() => selectDownloads()}
    >
      {/* Clips against its own box, not the button's, whose rounding would cut the ring short. */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
        <Transition
          as="span"
          enter="transition-[translate,opacity] duration-350"
          enterFrom="-translate-y-[200%] opacity-0 motion-reduce:translate-y-0"
          enterTo="translate-y-0 opacity-100"
          leave="transition-[translate,opacity] duration-300"
          leaveFrom="translate-y-0 opacity-100"
          leaveTo="translate-y-[200%] opacity-0 motion-reduce:translate-y-0"
          show={isArrowShown}
        >
          <Icon
            className="transition-colors"
            path={isActive ? mdiDownload : mdiDownloadOutline}
            size="lg"
          />
        </Transition>
      </span>

      {/* The delay waits out the arrow's leave; `afterLeave` then lets the arrow back. */}
      <Transition
        afterLeave={showArrow}
        as="div"
        className="flex flex-col items-center gap-y-0.5"
        enter="transition-opacity duration-250 delay-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        show={isRunning}
      >
        {shown.value !== undefined && (
          <Typography as="span" brand="none" className="leading-none font-semibold" type="body-sm">
            {shown.value}
          </Typography>
        )}

        <span className="text-[0.375rem] leading-none tracking-[1px] uppercase">{shown.unit}</span>
      </Transition>

      {isRunning && (
        <ProgressRing isActive={isActive} isPaused={isPaused} progress={shown.progress} />
      )}
    </SpineButton>
  );
};

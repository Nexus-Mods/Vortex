import { useEffect, useRef, useState } from "react";

import type { IDownload } from "@/extensions/download_management/types/IDownload";

/** Weight given to the newest sample, low enough that a stalled second doesn't spike it. */
const SMOOTHING = 0.3;
/** Below this, a gap says more about dispatch timing than about bandwidth. */
const MIN_SAMPLE_MS = 250;

/**
 * How long a download has left, and when there's no answer, why not — "still working it
 * out" has to be distinguishable from "never going to know", or a paused download reads
 * as one that is starting.
 */
export type DownloadEta =
  | { status: "estimating" }
  | { status: "ready"; seconds: number }
  | { status: "unavailable" };

/**
 * Time remaining for one download.
 *
 * Sampled rather than read off the store: `downloads.speed` is the aggregate across every
 * download, and `startTime` is dead — nothing has written it since the `init` ->
 * `started` flip moved into the progress reducer.
 */
export const useDownloadEta = (download: IDownload | undefined): DownloadEta => {
  const received = download?.received;
  const size = download?.size;
  const isRunning = download?.state === "started";
  // `init` has nothing to measure yet but is still on its way, unlike paused or finishing.
  const isStarting = download?.state === "init" || isRunning;

  const [rate, setRate] = useState<number | undefined>(undefined);
  const sampleRef = useRef<{ at: number; received: number } | undefined>(undefined);

  useEffect(() => {
    sampleRef.current = undefined;
    setRate(undefined);
  }, [download?.id]);

  useEffect(() => {
    if (received === undefined || !isRunning) {
      return;
    }

    const now = Date.now();
    const previous = sampleRef.current;

    if (previous === undefined) {
      sampleRef.current = { at: now, received };
      return;
    }

    const elapsed = now - previous.at;

    // Keep the older reading rather than replacing it, so updates that are each too close
    // together still add up to one gap wide enough to measure. Replacing it every time
    // means a fast, regular cadence never measures anything.
    if (elapsed < MIN_SAMPLE_MS) {
      return;
    }

    sampleRef.current = { at: now, received };

    const delta = received - previous.received;

    if (delta <= 0) {
      return;
    }

    const sampled = (delta * 1000) / elapsed;
    setRate((current) =>
      current === undefined ? sampled : current + SMOOTHING * (sampled - current),
    );
  }, [isRunning, received]);

  // Paused, finishing or gone: there is no estimate to make, rather than one pending.
  if (!isStarting) {
    return { status: "unavailable" };
  }

  // Running with no size means the server never sent one, so an estimate never arrives.
  // While still `init` a missing size is just one the first progress hasn't reported yet.
  if (isRunning && (size === undefined || size <= 0)) {
    return { status: "unavailable" };
  }

  if (!isRunning || received === undefined || size === undefined || !rate || rate <= 0) {
    return { status: "estimating" };
  }

  return { status: "ready", seconds: Math.max(0, (size - received) / rate) };
};

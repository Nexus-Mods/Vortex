import { getErrorMessageOrDefault } from "@vortex/shared";
import type { UpdaterSnapshot, UpdaterStatusResponse } from "@vortex/shared/ipc";

import { log } from "../../util/log";

/**
 * Pull, not push, like the downloader (IPCDownloadAdapter.ts) and uploader
 * (uploadV3.ts): main keeps the state, the renderer reads it at its own pace.
 *
 * Shaped like the uploader's loop: it runs only while something is happening.
 * Every updater activity starts in this process (launch check, periodic timer,
 * button presses), so the loop is woken just before and stops once the state
 * settles. An idle Vortex makes no updater IPC.
 *
 * Unlike a transfer, the UI reacts to transitions: a manual check that finds
 * nothing is `checking` for ~300 ms then `idle`, and the "up to date" toast
 * needs to have seen the `checking`. So main numbers snapshots and each poll
 * asks for everything since the last one it saw.
 */

/** Poll cadence while the updater is busy; the downloader's figure. */
export const POLL_MS = 200;
/** How long after a renderer request polling continues if the state stays settled. */
export const WAKE_WINDOW_MS = 2000;

export type StatusListener = (snapshot: UpdaterSnapshot) => void;

export interface UpdaterStatusPoller {
  /** Called with every snapshot in order; returns an unsubscribe function. */
  subscribe(listener: StatusListener): () => void;
  /** The most recent snapshot seen, if any. */
  current(): UpdaterSnapshot | undefined;
  /**
   * Poll now and keep polling for a moment. Called right after every
   * renderer -> main updater request so the resulting transition is seen.
   */
  wake(): void;
  /** Poll once for the initial state (and keep going if it is busy). */
  start(): void;
  stop(): void;
}

function isBusy(snapshot: UpdaterSnapshot | undefined): boolean {
  return snapshot?.state.type === "checking" || snapshot?.state.type === "downloading";
}

export function createUpdaterStatusPoller(
  getStatus: (since?: number) => Promise<UpdaterStatusResponse>,
): UpdaterStatusPoller {
  const listeners = new Set<StatusListener>();
  let latest: UpdaterSnapshot | undefined;
  let lastSeq: number | undefined;
  let enabled = false;
  let looping = false;
  let wakeUntil = 0;
  let wakeEarly: (() => void) | undefined;

  const deliver = (snapshot: UpdaterSnapshot) => {
    latest = snapshot;
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const tick = async () => {
    try {
      const response = await getStatus(lastSeq);
      // first poll: just the latest; afterwards: everything since the last seen
      const snapshots = lastSeq === undefined ? [response.snapshot] : response.changes;
      lastSeq = response.seq;
      for (const snapshot of snapshots) {
        deliver(snapshot);
      }
    } catch (err) {
      // a dropped sample is not worth killing the loop over
      log("debug", "updater status poll failed", { error: getErrorMessageOrDefault(err) });
    }
  };

  const shouldKeepPolling = () => isBusy(latest) || Date.now() < wakeUntil;

  // interruptible, so wake() does not have to wait out an interval
  const sleep = () =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, POLL_MS);
      wakeEarly = () => {
        clearTimeout(timer);
        resolve();
      };
    });

  // Runs until the state has settled and the wake window has passed, then
  // exits; wake() starts it again.
  const loop = async () => {
    looping = true;
    try {
      while (enabled) {
        await tick();
        if (!enabled || !shouldKeepPolling()) {
          return;
        }
        await sleep();
        wakeEarly = undefined;
      }
    } finally {
      looping = false;
    }
  };

  const ensureLooping = () => {
    if (!enabled) {
      return;
    }
    if (looping) {
      wakeEarly?.();
    } else {
      void loop();
    }
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    current: () => latest,
    wake() {
      wakeUntil = Date.now() + WAKE_WINDOW_MS;
      ensureLooping();
    },
    start() {
      if (enabled) {
        return;
      }
      enabled = true;
      ensureLooping();
    },
    stop() {
      enabled = false;
      wakeEarly?.();
    },
  };
}

// The extension creates one poller per window at init; the settings page
// reads from the same one rather than running a second loop.
let instance: UpdaterStatusPoller | undefined;

export function initUpdaterStatus(
  getStatus: (since?: number) => Promise<UpdaterStatusResponse>,
): UpdaterStatusPoller {
  instance?.stop();
  instance = createUpdaterStatusPoller(getStatus);
  instance.start();
  return instance;
}

export function getUpdaterStatus(): UpdaterStatusPoller | undefined {
  return instance;
}

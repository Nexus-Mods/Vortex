import type { UpdaterSnapshot, UpdaterStatusResponse } from "@vortex/shared/ipc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../util/log", () => ({ log: vi.fn() }));

import { createUpdaterStatusPoller, POLL_MS, WAKE_WINDOW_MS } from "./updaterStatus";

// A stand-in for main: numbered snapshots, replayed since a sequence number,
// exactly like the updater:get-status handler.
function fakeMain(initial: UpdaterSnapshot = { state: { type: "idle" } }) {
  let seq = 0;
  let latest = initial;
  const history: Array<{ seq: number; snapshot: UpdaterSnapshot }> = [];
  const getStatus = vi.fn(
    async (since?: number): Promise<UpdaterStatusResponse> => ({
      seq,
      snapshot: latest,
      changes:
        since == null
          ? []
          : history.filter((entry) => entry.seq > since).map((entry) => entry.snapshot),
    }),
  );
  return {
    getStatus,
    push(snapshot: UpdaterSnapshot) {
      seq += 1;
      latest = snapshot;
      history.push({ seq, snapshot });
    },
  };
}

const downloading: UpdaterSnapshot = {
  state: { type: "downloading", version: "2.7.0", kind: "update", manual: true },
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("updater status poller", () => {
  it("delivers the latest snapshot on the first poll", async () => {
    const main = fakeMain({ state: { type: "available", version: "2.7.0" } });
    const poller = createUpdaterStatusPoller(main.getStatus);
    const seen: UpdaterSnapshot[] = [];
    poller.subscribe((snapshot) => seen.push(snapshot));

    poller.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(seen).toHaveLength(1);
    expect(seen[0]!.state).toMatchObject({ type: "available", version: "2.7.0" });
    expect(poller.current()).toBe(seen[0]);
    poller.stop();
  });

  // An idle Vortex makes no updater IPC: every updater activity starts in the
  // renderer, so the loop is woken before anything can happen.
  it("stops polling once the state is settled", async () => {
    const main = fakeMain();
    const poller = createUpdaterStatusPoller(main.getStatus);
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    main.getStatus.mockClear();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(main.getStatus).not.toHaveBeenCalled();
    poller.stop();
  });

  // The reason polls carry a sequence number: a manual check that finds
  // nothing is `checking` for a few hundred ms then `idle`; the UI needs to
  // have seen the `checking` to answer "up to date".
  it("wake() polls at once and delivers every transition since, in order", async () => {
    const main = fakeMain();
    const poller = createUpdaterStatusPoller(main.getStatus);
    const seen: string[] = [];
    poller.subscribe((snapshot) => seen.push(snapshot.state.type));
    poller.start();
    await vi.advanceTimersByTimeAsync(0);

    // the renderer sent check-for-updates; main went through both states
    // before the next poll landed
    main.push({ state: { type: "checking", manual: true } });
    main.push({ state: { type: "idle" } });
    poller.wake();
    await vi.advanceTimersByTimeAsync(0);

    expect(seen).toEqual(["idle", "checking", "idle"]);
    poller.stop();
  });

  it("keeps polling at the download cadence while busy, then stops when settled", async () => {
    const main = fakeMain();
    const poller = createUpdaterStatusPoller(main.getStatus);
    poller.start();
    await vi.advanceTimersByTimeAsync(0);

    main.push(downloading);
    poller.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(poller.current()?.state.type).toBe("downloading");

    // well past the wake window: still polling because the state is busy
    await vi.advanceTimersByTimeAsync(WAKE_WINDOW_MS * 2);
    main.getStatus.mockClear();
    await vi.advanceTimersByTimeAsync(POLL_MS * 5);
    expect(main.getStatus.mock.calls.length).toBeGreaterThanOrEqual(4);

    // settled: the next poll sees it and the loop exits
    main.push({ state: { type: "staged", version: "2.7.0", kind: "update" } });
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(poller.current()?.state.type).toBe("staged");
    main.getStatus.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(main.getStatus).not.toHaveBeenCalled();
    poller.stop();
  });

  it("keeps polling for the wake window even if the state is not busy yet", async () => {
    const main = fakeMain();
    const poller = createUpdaterStatusPoller(main.getStatus);
    poller.start();
    await vi.advanceTimersByTimeAsync(0);

    // a request was sent but main has not transitioned yet
    poller.wake();
    await vi.advanceTimersByTimeAsync(0);
    main.getStatus.mockClear();
    await vi.advanceTimersByTimeAsync(WAKE_WINDOW_MS - POLL_MS);
    expect(main.getStatus.mock.calls.length).toBeGreaterThanOrEqual(5);

    // a late transition inside the window is still picked up
    main.push({ state: { type: "available", version: "2.7.0" } });
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(poller.current()?.state.type).toBe("available");
    poller.stop();
  });

  it("survives a failed poll", async () => {
    const main = fakeMain();
    const poller = createUpdaterStatusPoller(main.getStatus);
    const seen: string[] = [];
    poller.subscribe((snapshot) => seen.push(snapshot.state.type));
    poller.start();
    await vi.advanceTimersByTimeAsync(0);

    main.getStatus.mockRejectedValueOnce(new Error("ipc down"));
    main.push({ state: { type: "available", version: "2.7.0" } });
    poller.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual(["idle"]);
    // the wake window is still open, so the next poll catches up
    await vi.advanceTimersByTimeAsync(POLL_MS);

    expect(seen).toEqual(["idle", "available"]);
    poller.stop();
  });

  it("stops delivering after unsubscribe and after stop", async () => {
    const main = fakeMain();
    const poller = createUpdaterStatusPoller(main.getStatus);
    const seen: string[] = [];
    const unsubscribe = poller.subscribe((snapshot) => seen.push(snapshot.state.type));
    poller.start();
    await vi.advanceTimersByTimeAsync(0);

    unsubscribe();
    main.push({ state: { type: "available", version: "2.7.0" } });
    poller.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual(["idle"]);

    poller.stop();
    main.getStatus.mockClear();
    poller.wake();
    await vi.advanceTimersByTimeAsync(WAKE_WINDOW_MS);
    expect(main.getStatus).not.toHaveBeenCalled();
  });
});

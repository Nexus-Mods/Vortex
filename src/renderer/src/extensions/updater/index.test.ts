import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionContext } from "../../types/IExtensionContext";

vi.mock("../../util/application", () => ({
  getApplication: () => ({ version: "2.6.0-beta.1" }),
}));

import init from "./index";

interface FakeStatus {
  available: boolean;
  downloaded: boolean;
  version?: string;
  releaseNotes?: string;
  downgrade?: boolean;
  checking?: boolean;
}

function makeContext() {
  const onceCallbacks: Array<() => void> = [];
  const sendNotification = vi.fn();
  const state = {
    app: { installType: "regular" },
    settings: { update: { channel: "stable" } },
  };
  const context = {
    registerReducer: vi.fn(),
    registerSettings: vi.fn(),
    once: (cb: () => void) => onceCallbacks.push(cb),
    api: {
      getState: () => state,
      sendNotification,
      showDialog: vi.fn().mockResolvedValue({ action: "Close" }),
      onStateChange: vi.fn(),
      store: { getState: () => state },
    },
  } as unknown as IExtensionContext;
  return { context, sendNotification, runOnce: () => onceCallbacks.forEach((cb) => cb()) };
}

function makeUpdaterApi(initialStatus: FakeStatus) {
  let statusListener: ((status: FakeStatus) => void) | undefined;
  const updater = {
    getStatus: vi.fn().mockResolvedValue(initialStatus),
    setChannel: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    restartAndInstall: vi.fn(),
    onStatusChanged: vi.fn((cb: (status: FakeStatus) => void) => {
      statusListener = cb;
      return () => undefined;
    }),
  };
  return { updater, pushStatus: (status: FakeStatus) => statusListener?.(status) };
}

const idleStatus: FakeStatus = { available: false, downloaded: false };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

async function setup(initialStatus: FakeStatus = idleStatus) {
  const { context, sendNotification, runOnce } = makeContext();
  const { updater, pushStatus } = makeUpdaterApi(initialStatus);
  vi.stubGlobal("window", { api: { updater } });
  init(context);
  runOnce();
  // let the initial getStatus sync settle
  await vi.advanceTimersByTimeAsync(0);
  return { sendNotification, updater, pushStatus };
}

describe("updater status handling", () => {
  it("shows the update notification when a pushed status is available", async () => {
    const { sendNotification, pushStatus } = await setup();

    pushStatus({ available: true, downloaded: false, version: "2.7.0" });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const notification = sendNotification.mock.calls[0]![0];
    expect(notification.id).toBe("vortex-update-available");
    expect(notification.message).toContain("2.7.0");
    // not downloaded yet: the action is a download, and must say so
    expect(notification.actions[1].title).toBe("Download");
  });

  // Regression pin #22826: a later "downloaded" status must update the same
  // notification (same id — upsert), flipping the action to Restart.
  it("updates the same notification when the download completes", async () => {
    const { sendNotification, pushStatus } = await setup();

    pushStatus({ available: true, downloaded: false, version: "2.7.0" });
    pushStatus({ available: true, downloaded: true, version: "2.7.0" });

    expect(sendNotification).toHaveBeenCalledTimes(2);
    const first = sendNotification.mock.calls[0]![0];
    const second = sendNotification.mock.calls[1]![0];
    expect(second.id).toBe(first.id);
    expect(first.actions[1].title).toBe("Download");
    expect(second.actions[1].title).toBe("Restart & Install");
  });

  it("presents a downgrade status as an explicit downgrade offer, not an update", async () => {
    const { sendNotification, pushStatus } = await setup();

    pushStatus({ available: true, downloaded: false, version: "2.5.0", downgrade: true });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const notification = sendNotification.mock.calls[0]![0];
    expect(notification.id).toBe("vortex-downgrade-offer");
    expect(notification.type).toBe("warning");
    expect(notification.message).toContain("older");
  });

  it("syncs the initial status via getStatus for checks that finished early", async () => {
    const { sendNotification } = await setup({
      available: true,
      downloaded: false,
      version: "2.8.0",
    });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification.mock.calls[0]![0].message).toContain("2.8.0");
  });

  it("ignores non-available statuses (checking, progress)", async () => {
    const { sendNotification, pushStatus } = await setup();

    pushStatus({ available: false, downloaded: false, checking: true });
    pushStatus({ available: false, downloaded: false });

    expect(sendNotification).not.toHaveBeenCalled();
  });
});

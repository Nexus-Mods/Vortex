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
  manual?: boolean;
}

interface FakeNotification {
  id: string;
  type?: string;
  message?: string;
  actions?: Array<{ title: string; action: (dismiss: () => void) => void }>;
}

function makeContext() {
  const onceCallbacks: Array<() => void> = [];
  // mirror the notifications reducer: same-id send replaces, dismiss removes
  const notifications: FakeNotification[] = [];
  const sendNotification = vi.fn((notification: FakeNotification) => {
    const existing = notifications.findIndex((entry) => entry.id === notification.id);
    if (existing >= 0) {
      notifications.splice(existing, 1, notification);
    } else {
      notifications.push(notification);
    }
  });
  const dismissNotification = vi.fn((id: string) => {
    const existing = notifications.findIndex((entry) => entry.id === id);
    if (existing >= 0) {
      notifications.splice(existing, 1);
    }
  });
  const state = {
    app: { installType: "regular" },
    settings: { update: { channel: "stable" } },
    session: { notifications: { notifications } },
  };
  const context = {
    registerReducer: vi.fn(),
    registerSettings: vi.fn(),
    once: (cb: () => void) => onceCallbacks.push(cb),
    api: {
      getState: () => state,
      sendNotification,
      dismissNotification,
      showDialog: vi.fn().mockResolvedValue({ action: "Close" }),
      onStateChange: vi.fn(),
      store: { getState: () => state },
    },
  } as unknown as IExtensionContext;
  return {
    context,
    sendNotification,
    dismissNotification,
    notifications,
    runOnce: () => onceCallbacks.forEach((cb) => cb()),
  };
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
  const { context, sendNotification, dismissNotification, notifications, runOnce } = makeContext();
  const { updater, pushStatus } = makeUpdaterApi(initialStatus);
  vi.stubGlobal("window", { api: { updater } });
  init(context);
  runOnce();
  // let the initial getStatus sync settle
  await vi.advanceTimersByTimeAsync(0);
  return { sendNotification, dismissNotification, notifications, updater, pushStatus };
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
    // install-on-quit is disclosed once the download is staged
    expect(second.message).toContain("will install when you close Vortex");
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

  it("re-creates the notification on transitions but not on identical pushes", async () => {
    const { sendNotification, pushStatus } = await setup();

    pushStatus({ available: true, downloaded: false, version: "2.7.0" });
    // identical push (e.g. re-broadcast) must not churn the notification
    pushStatus({ available: true, downloaded: false, version: "2.7.0" });
    expect(sendNotification).toHaveBeenCalledTimes(1);

    // a transition (download finished) re-creates it so the toast re-shows
    pushStatus({ available: true, downloaded: true, version: "2.7.0" });
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  // Field report: after a dismissed notification (e.g. clicking Restart &
  // Install in dev), a manual re-check of the same version showed nothing.
  it("resurrects a dismissed notification on the next identical status", async () => {
    const { sendNotification, notifications, pushStatus } = await setup();

    pushStatus({ available: true, downloaded: false, version: "2.7.0" });
    expect(sendNotification).toHaveBeenCalledTimes(1);

    // user dismisses it (or an action did)
    notifications.length = 0;

    pushStatus({ available: true, downloaded: false, version: "2.7.0" });
    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(notifications.some((entry) => entry.id === "vortex-update-available")).toBe(true);
  });

  it("shows an up-to-date toast when a manual check finds nothing", async () => {
    const { sendNotification, pushStatus } = await setup();

    pushStatus({ available: false, downloaded: false, checking: true, manual: true });
    pushStatus({ available: false, downloaded: false, checking: false, manual: true });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const toast = sendNotification.mock.calls[0]![0];
    expect(toast.id).toBe("vortex-up-to-date");
    expect(toast.message).toContain("up to date");
  });

  it("re-toasts the unchanged update notification after a manual check", async () => {
    const { sendNotification, pushStatus } = await setup();

    pushStatus({ available: true, downloaded: false, version: "2.7.0" });
    expect(sendNotification).toHaveBeenCalledTimes(1);

    // manual re-check resolves the same version: user still expects feedback
    pushStatus({
      available: true,
      downloaded: false,
      version: "2.7.0",
      checking: true,
      manual: true,
    });
    pushStatus({
      available: true,
      downloaded: false,
      version: "2.7.0",
      checking: false,
      manual: true,
    });

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(sendNotification.mock.calls[1]![0].id).toBe("vortex-update-available");
  });

  it("stays quiet when a background check finds nothing", async () => {
    const { sendNotification, pushStatus } = await setup();

    pushStatus({ available: false, downloaded: false, checking: true, manual: false });
    pushStatus({ available: false, downloaded: false, checking: false, manual: false });

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("re-checks periodically so long sessions hear about updates", async () => {
    const { updater } = await setup();
    updater.checkForUpdates.mockClear();

    await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000);
    expect(updater.checkForUpdates).toHaveBeenCalledWith("stable", false);

    await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it("ignores non-available statuses (checking, progress)", async () => {
    const { sendNotification, pushStatus } = await setup();

    pushStatus({ available: false, downloaded: false, checking: true });
    pushStatus({ available: false, downloaded: false });

    expect(sendNotification).not.toHaveBeenCalled();
  });
});

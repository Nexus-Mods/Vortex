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
  downgrading?: boolean;
  checking?: boolean;
  manual?: boolean;
  patch?: boolean;
  justUpdatedFrom?: string;
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
  const showDialog = vi.fn().mockResolvedValue({ action: "Close" });
  const context = {
    registerReducer: vi.fn(),
    registerSettings: vi.fn(),
    once: (cb: () => void) => onceCallbacks.push(cb),
    api: {
      getState: () => state,
      sendNotification,
      dismissNotification,
      showDialog,
      onStateChange: vi.fn(),
      store: { getState: () => state },
    },
  } as unknown as IExtensionContext;
  return {
    context,
    sendNotification,
    dismissNotification,
    showDialog,
    notifications,
    runOnce: () => onceCallbacks.forEach((cb) => cb()),
  };
}

function makeUpdaterApi(initialStatus: FakeStatus) {
  let statusListener: ((status: FakeStatus) => void) | undefined;
  const updater = {
    getStatus: vi.fn().mockResolvedValue(initialStatus),
    getUpdateChangelog: vi.fn().mockResolvedValue(null),
    setChannel: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    downloadDowngrade: vi.fn(),
    declineDowngrade: vi.fn(),
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
  const { context, sendNotification, dismissNotification, showDialog, notifications, runOnce } =
    makeContext();
  const { updater, pushStatus } = makeUpdaterApi(initialStatus);
  vi.stubGlobal("window", { api: { updater } });
  init(context);
  runOnce();
  // let the initial getStatus sync settle
  await vi.advanceTimersByTimeAsync(0);
  return { sendNotification, dismissNotification, showDialog, notifications, updater, pushStatus };
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
    expect(first.message).toContain("available to download");
    expect(second.actions[1].title).toBe("Restart Now");
    expect(second.message).toContain("ready to install");
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

  // Field report: declining left the warning notification up and the offer
  // armed in main — "Stay on current version" must actually reset both.
  it("declining the downgrade dismisses the notification and tells main", async () => {
    const { sendNotification, dismissNotification, showDialog, updater, pushStatus } =
      await setup();

    pushStatus({ available: true, downloaded: false, version: "2.5.0", downgrade: true });
    const offer = sendNotification.mock.calls[0]![0];

    // open the downgrade dialog via the notification's More action
    offer.actions![0]!.action(() => undefined);
    await vi.advanceTimersByTimeAsync(0);

    const buttons = showDialog.mock.calls[0]![3] as Array<{
      label: string;
      action?: () => void;
    }>;
    const stay = buttons.find((button) => button.label === "Stay on current version");
    expect(stay?.action).toBeDefined();
    stay!.action!();

    expect(dismissNotification).toHaveBeenCalledWith("vortex-downgrade-offer");
    expect(updater.declineDowngrade).toHaveBeenCalledTimes(1);
    expect(updater.downloadDowngrade).not.toHaveBeenCalled();
  });

  it("confirming the downgrade downloads without an automatic restart", async () => {
    const { sendNotification, showDialog, updater, pushStatus } = await setup();

    pushStatus({ available: true, downloaded: false, version: "2.5.0", downgrade: true });
    sendNotification.mock.calls[0]![0].actions![0]!.action(() => undefined);
    await vi.advanceTimersByTimeAsync(0);

    const buttons = showDialog.mock.calls[0]![3] as Array<{
      label: string;
      action?: () => void;
    }>;
    buttons.find((button) => button.label === "Downgrade to 2.5.0")!.action!();

    expect(updater.downloadDowngrade).toHaveBeenCalledWith(false);
  });

  // Field report: a confirmed downgrade was narrated as a regular update
  // ("9.0.0 is available" with a Download button) while it was downloading.
  it("presents a confirmed downgrade as a downgrade, then as ready to install", async () => {
    const { sendNotification, pushStatus } = await setup();

    pushStatus({ available: true, downloaded: false, version: "2.5.0", downgrading: true });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const downloading = sendNotification.mock.calls[0]![0];
    expect(downloading.id).toBe("vortex-update-available");
    expect(downloading.message).toContain("Downgrading to Vortex 2.5.0");
    // committed flow: nothing for the user to click while it downloads
    expect(downloading.actions).toBeUndefined();

    // once staged it reads like any other staged update, same buttons
    pushStatus({ available: true, downloaded: true, version: "2.5.0", downgrading: true });
    const downloaded = sendNotification.mock.calls[1]![0];
    expect(downloaded.message).toContain("2.5.0 is ready to install");
    expect(downloaded.actions![0]!.title).toBe("What's New");
    expect(downloaded.actions![1]!.title).toBe("Restart Now");
  });

  it("keeps a patch update quiet until staged, then offers a restart", async () => {
    const { sendNotification, updater, pushStatus } = await setup();

    // auto-downloading: nothing to decide, no notification churn
    pushStatus({ available: true, downloaded: false, version: "2.6.1", patch: true });
    expect(sendNotification).not.toHaveBeenCalled();

    pushStatus({ available: true, downloaded: true, version: "2.6.1", patch: true });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const notification = sendNotification.mock.calls[0]![0];
    expect(notification.id).toBe("vortex-update-available");
    expect(notification.message).toBe("Vortex will update the next time you restart");
    expect(notification.actions).toHaveLength(1);
    expect(notification.actions![0]!.title).toBe("Restart Now");

    notification.actions![0]!.action(() => undefined);
    expect(updater.restartAndInstall).toHaveBeenCalledTimes(1);
  });

  it("shows a one-time 'was updated' notice on the first launch after an update", async () => {
    const { sendNotification, pushStatus } = await setup();

    pushStatus({ available: false, downloaded: false, justUpdatedFrom: "2.5.9" });
    pushStatus({ available: false, downloaded: false, justUpdatedFrom: "2.5.9" });

    const updated = sendNotification.mock.calls.filter(
      ([notification]) => notification.id === "vortex-updated",
    );
    expect(updated).toHaveLength(1);
    expect(updated[0]![0].message).toContain("was updated to 2.6.0-beta.1");
    expect(updated[0]![0].actions![0]!.title).toBe("View changes");
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

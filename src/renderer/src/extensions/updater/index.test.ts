import { EventEmitter } from "node:events";

import type { UpdaterSnapshot, UpdaterState, UpdaterStatusResponse } from "@vortex/shared/ipc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionContext } from "../../types/IExtensionContext";

vi.mock("../../util/application", () => ({
  getApplication: () => ({ version: "2.6.0-beta.1" }),
}));

import type { MixpanelEvent } from "../analytics/mixpanel/MixpanelEvents";
import init from "./index";
import { getUpdaterStatus } from "./updaterStatus";

interface FakeNotification {
  id: string;
  type?: string;
  message?: string;
  progress?: number;
  displayMS?: number;
  actions?: Array<{ title: string; action: (dismiss: () => void) => void }>;
  onDismiss?: () => void;
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
  // like the real dismissNotification thunk: remove, then fire onDismiss
  const dismissNotification = vi.fn((id: string) => {
    const existing = notifications.findIndex((entry) => entry.id === id);
    if (existing >= 0) {
      const [removed] = notifications.splice(existing, 1);
      removed?.onDismiss?.();
    }
  });
  const state = {
    app: { installType: "regular", updaterActive: true },
    settings: { update: { channel: "stable" } },
    session: { notifications: { notifications } },
  };
  const showDialog = vi.fn().mockResolvedValue({ action: "Close" });
  const dispatch = vi.fn();
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
      events: new EventEmitter(),
      store: { getState: () => state, dispatch },
    },
  } as unknown as IExtensionContext;
  return {
    context,
    sendNotification,
    dismissNotification,
    showDialog,
    dispatch,
    notifications,
    runOnce: () => onceCallbacks.forEach((cb) => cb()),
  };
}

// A stand-in for main's updater:get-status: numbered snapshots replayed since
// a sequence number, which is what the renderer's poller consumes.
function makeUpdaterApi(initialSnapshot: UpdaterSnapshot) {
  let seq = 0;
  let latest = initialSnapshot;
  const history: Array<{ seq: number; snapshot: UpdaterSnapshot }> = [];
  const updater = {
    getStatus: vi.fn(
      async (since?: number): Promise<UpdaterStatusResponse> => ({
        seq,
        snapshot: latest,
        changes:
          since == null
            ? []
            : history.filter((entry) => entry.seq > since).map((entry) => entry.snapshot),
      }),
    ),
    getUpdateChangelog: vi.fn().mockResolvedValue(null),
    setChannel: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    downloadDowngrade: vi.fn(),
    declineDowngrade: vi.fn(),
    cancelDownload: vi.fn(),
    restartAndInstall: vi.fn(),
  };
  return {
    updater,
    // main moved to a new state; wake the poller (as any renderer request
    // would) and let the poll deliver it
    pushState: async (state: UpdaterState, justUpdatedFrom?: string) => {
      seq += 1;
      latest = { state, justUpdatedFrom };
      history.push({ seq, snapshot: latest });
      getUpdaterStatus()?.wake();
      await vi.advanceTimersByTimeAsync(0);
    },
  };
}

const idle: UpdaterSnapshot = { state: { type: "idle" } };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

async function setup(initialSnapshot: UpdaterSnapshot = idle) {
  const {
    context,
    sendNotification,
    dismissNotification,
    showDialog,
    dispatch,
    notifications,
    runOnce,
  } = makeContext();
  const { updater, pushState } = makeUpdaterApi(initialSnapshot);
  vi.stubGlobal("window", { api: { updater } });
  init(context);
  runOnce();
  // let the poller's first poll deliver the initial snapshot
  await vi.advanceTimersByTimeAsync(0);
  return {
    context,
    sendNotification,
    dismissNotification,
    showDialog,
    dispatch,
    notifications,
    updater,
    pushState,
  };
}

function sent(sendNotification: ReturnType<typeof vi.fn>, id: string): FakeNotification[] {
  return sendNotification.mock.calls
    .map(([notification]) => notification as FakeNotification)
    .filter((notification) => notification.id === id);
}

describe("updater state rendering", () => {
  // Components (the Settings page) read the updater's state from redux so it
  // survives leaving and re-entering the page.
  it("puts every polled snapshot into session.updater", async () => {
    const { dispatch, pushState } = await setup();

    await pushState({ type: "checking", manual: true });
    await pushState({ type: "downloading", version: "2.7.0", kind: "update", manual: true });

    const snapshots = dispatch.mock.calls
      .map(([action]) => action as { type: string; payload: UpdaterSnapshot })
      .filter((action) => action.type === "SET_UPDATER_SNAPSHOT")
      .map((action) => action.payload.state.type);
    expect(snapshots).toEqual(["idle", "checking", "downloading"]);
  });

  it("shows the update notification for an available state", async () => {
    const { sendNotification, pushState } = await setup();

    await pushState({ type: "available", version: "2.7.0" });

    const updates = sent(sendNotification, "vortex-update-available");
    expect(updates).toHaveLength(1);
    expect(updates[0]!.message).toBe("Vortex 2.7.0 is available to download");
    expect(updates[0]!.actions!.map((action) => action.title)).toEqual(["What's New", "Download"]);
  });

  // Regression pin #22826: a later "staged" state must update the same
  // notification (same id, upsert), flipping the action to Restart Now.
  it("updates the same notification when the download completes", async () => {
    const { sendNotification, pushState } = await setup();

    await pushState({ type: "available", version: "2.7.0" });
    await pushState({ type: "staged", version: "2.7.0", kind: "update" });

    const updates = sent(sendNotification, "vortex-update-available");
    expect(updates).toHaveLength(2);
    expect(updates[1]!.message).toBe("Vortex 2.7.0 is ready to install");
    expect(updates[1]!.actions!.map((action) => action.title)).toEqual([
      "What's New",
      "Restart Now",
    ]);
  });

  it("presents a downgrade offer as exactly that, never as an update", async () => {
    const { sendNotification, pushState } = await setup();

    await pushState({ type: "downgrade-offered", version: "2.5.0" });

    const offers = sent(sendNotification, "vortex-downgrade-offer");
    expect(offers).toHaveLength(1);
    expect(offers[0]!.type).toBe("warning");
    expect(offers[0]!.message).toContain("downgrade and older");
    expect(sent(sendNotification, "vortex-update-available")).toHaveLength(0);
  });

  it("syncs the initial state via getStatus for checks that settled early", async () => {
    const { sendNotification } = await setup({
      state: { type: "available", version: "2.8.0" },
    });

    const updates = sent(sendNotification, "vortex-update-available");
    expect(updates).toHaveLength(1);
    expect(updates[0]!.message).toContain("2.8.0");
  });

  it("re-creates the notification on transitions but not on identical pushes", async () => {
    const { sendNotification, pushState } = await setup();

    await pushState({ type: "available", version: "2.7.0" });
    // identical push (e.g. re-broadcast) must not churn the notification
    await pushState({ type: "available", version: "2.7.0" });
    expect(sent(sendNotification, "vortex-update-available")).toHaveLength(1);

    // a transition (download finished) re-creates it so the toast re-shows
    await pushState({ type: "staged", version: "2.7.0", kind: "update" });
    expect(sent(sendNotification, "vortex-update-available")).toHaveLength(2);
  });

  // Field report: after a dismissed notification, a re-check of the same
  // version showed nothing.
  it("resurrects a dismissed notification on the next identical state", async () => {
    const { sendNotification, notifications, pushState } = await setup();

    await pushState({ type: "available", version: "2.7.0" });
    expect(sent(sendNotification, "vortex-update-available")).toHaveLength(1);

    // user dismisses it (or an action did)
    notifications.length = 0;

    await pushState({ type: "available", version: "2.7.0" });
    expect(sent(sendNotification, "vortex-update-available")).toHaveLength(2);
    expect(notifications.some((entry) => entry.id === "vortex-update-available")).toBe(true);
  });
});

describe("manual check feedback (a pressed button always answers)", () => {
  it("shows 'Checking...' the moment a manual check starts", async () => {
    const { sendNotification, pushState } = await setup();

    await pushState({ type: "checking", manual: true });

    const checking = sent(sendNotification, "vortex-update-checking");
    expect(checking).toHaveLength(1);
    expect(checking[0]!.type).toBe("activity");
  });

  it("stays silent while a background check runs", async () => {
    const { sendNotification, pushState } = await setup();

    await pushState({ type: "checking", manual: false });
    await pushState({ type: "idle" });

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("shows an up-to-date toast when a manual check finds nothing", async () => {
    const { sendNotification, notifications, pushState } = await setup();

    await pushState({ type: "checking", manual: true });
    await pushState({ type: "idle" });

    const toasts = sent(sendNotification, "vortex-up-to-date");
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.message).toContain("up to date");
    // the Checking... feedback settled with the check
    expect(notifications.some((entry) => entry.id === "vortex-update-checking")).toBe(false);
  });

  it("re-toasts the unchanged update notification after a manual check", async () => {
    const { sendNotification, pushState } = await setup();

    await pushState({ type: "available", version: "2.7.0" });
    await pushState({ type: "checking", manual: true });
    await pushState({ type: "available", version: "2.7.0" });

    expect(sent(sendNotification, "vortex-update-available")).toHaveLength(2);
  });

  // Field report: a manual check that found a patch gave only a transient
  // toast while the download ran on invisibly, anything the user's press
  // set in motion downloads visibly, like the downgrade route.
  it("shows a manual check's patch download as a visible download", async () => {
    const { sendNotification, pushState } = await setup();

    await pushState({ type: "checking", manual: true });
    await pushState({ type: "downloading", version: "2.6.1", kind: "patch", manual: true });
    await pushState({
      type: "downloading",
      version: "2.6.1",
      kind: "patch",
      manual: true,
      percent: 30,
    });

    const updates = sent(sendNotification, "vortex-update-available");
    const last = updates.at(-1)!;
    expect(last.message).toBe("Downloading Vortex 2.6.1 (30%)");
    expect(last.type).toBe("activity");
    expect(last.actions).toBeUndefined();
  });

  it("does not claim 'up to date' when a manual check failed", async () => {
    const { sendNotification, pushState } = await setup();

    await pushState({ type: "checking", manual: true });
    await pushState({ type: "error", message: "network down", manual: true });

    expect(sent(sendNotification, "vortex-up-to-date")).toHaveLength(0);
    expect(sent(sendNotification, "vortex-update-error")).toHaveLength(1);
  });
});

describe("downloads", () => {
  // Ruling: closing the download notification is the one control it has, and
  // it means "stop". Our own dismissals (the state moved on) must not cancel.
  it("cancels the download when the user closes its notification", async () => {
    const { dismissNotification, updater, pushState } = await setup();

    await pushState({ type: "available", version: "2.7.0" });
    await pushState({
      type: "downloading",
      version: "2.7.0",
      kind: "update",
      manual: true,
      percent: 12,
    });

    // the user clicks the X
    dismissNotification("vortex-update-available");

    expect(updater.cancelDownload).toHaveBeenCalledTimes(1);
  });

  it("does not cancel when the notification is replaced or dismissed by a transition", async () => {
    const { updater, pushState } = await setup();

    await pushState({
      type: "downloading",
      version: "2.7.0",
      kind: "update",
      manual: true,
      percent: 12,
    });
    // progress ticks replace the notification in place
    await pushState({
      type: "downloading",
      version: "2.7.0",
      kind: "update",
      manual: true,
      percent: 40,
    });
    // the download finished: the renderer dismisses and re-sends as "ready to install"
    await pushState({ type: "staged", version: "2.7.0", kind: "update" });

    expect(updater.cancelDownload).not.toHaveBeenCalled();
  });

  it("shows live progress in the message without re-toasting each tick", async () => {
    const { sendNotification, dismissNotification, pushState } = await setup();

    await pushState({ type: "available", version: "2.7.0" });
    dismissNotification.mockClear();

    await pushState({
      type: "downloading",
      version: "2.7.0",
      kind: "update",
      manual: true,
      percent: 41,
    });
    await pushState({
      type: "downloading",
      version: "2.7.0",
      kind: "update",
      manual: true,
      percent: 42,
    });

    // progress ticks update in place: no dismiss (which would re-toast)
    expect(dismissNotification).not.toHaveBeenCalledWith("vortex-update-available");
    const updates = sent(sendNotification, "vortex-update-available");
    const last = updates.at(-1)!;
    expect(last.message).toBe("Downloading Vortex 2.7.0 (42%)");
    expect(last.progress).toBe(42);
    // "activity" is what makes the notifications panel render the bar
    expect(last.type).toBe("activity");
    // no buttons at all while downloading
    expect(last.actions).toBeUndefined();
  });

  it("keeps a patch download quiet until staged, then offers a restart", async () => {
    const { sendNotification, updater, pushState } = await setup();

    // auto-downloading: nothing to decide, no notification churn
    await pushState({ type: "downloading", version: "2.6.1", kind: "patch", manual: false });
    await pushState({
      type: "downloading",
      version: "2.6.1",
      kind: "patch",
      manual: false,
      percent: 50,
    });
    expect(sendNotification).not.toHaveBeenCalled();

    await pushState({ type: "staged", version: "2.6.1", kind: "patch" });
    const updates = sent(sendNotification, "vortex-update-available");
    expect(updates).toHaveLength(1);
    expect(updates[0]!.message).toBe("Vortex will update on restart");
    expect(updates[0]!.actions!.map((action) => action.title)).toEqual(["Restart Now"]);

    updates[0]!.actions![0]!.action(() => undefined);
    expect(updater.restartAndInstall).toHaveBeenCalledTimes(1);
  });

  // Field-tested: killing the feed mid-download left "Downloading..." frozen
  // with no retry. A failed download must recover to a retryable notification
  // alongside the error one.
  it("recovers a failed download to a retryable notification", async () => {
    const { sendNotification, notifications, pushState } = await setup();

    await pushState({ type: "available", version: "2.7.0" });
    await pushState({
      type: "downloading",
      version: "2.7.0",
      kind: "update",
      manual: true,
      percent: 40,
    });
    await pushState({
      type: "error",
      message: "net::ERR_CONNECTION_REFUSED",
      manual: true,
      retry: { version: "2.7.0" },
    });

    expect(notifications.some((entry) => entry.id === "vortex-update-error")).toBe(true);
    const updates = sent(sendNotification, "vortex-update-available");
    const last = updates.at(-1)!;
    expect(last.message).toBe("Vortex 2.7.0 is available to download");
    expect(last.actions!.map((action) => action.title)).toEqual(["What's New", "Download"]);
  });

  it("surfaces update errors once and withdraws them on recovery", async () => {
    const { sendNotification, notifications, pushState } = await setup();

    await pushState({ type: "error", message: "signature verification failed", manual: true });
    await pushState({ type: "error", message: "signature verification failed", manual: true });

    expect(sent(sendNotification, "vortex-update-error")).toHaveLength(1);
    expect(sent(sendNotification, "vortex-update-error")[0]!.type).toBe("error");

    // a later clean state clears the error notification
    await pushState({ type: "idle" });
    expect(notifications.some((entry) => entry.id === "vortex-update-error")).toBe(false);
  });
});

describe("downgrades", () => {
  it("declining the downgrade dismisses the notification and tells main", async () => {
    const { sendNotification, dismissNotification, showDialog, updater, pushState } = await setup();

    await pushState({ type: "downgrade-offered", version: "2.5.0" });
    const offer = sent(sendNotification, "vortex-downgrade-offer")[0]!;

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
    const { sendNotification, showDialog, updater, pushState } = await setup();

    await pushState({ type: "downgrade-offered", version: "2.5.0" });
    sent(sendNotification, "vortex-downgrade-offer")[0]!.actions![0]!.action(() => undefined);
    await vi.advanceTimersByTimeAsync(0);

    const buttons = showDialog.mock.calls[0]![3] as Array<{
      label: string;
      action?: () => void;
    }>;
    buttons.find((button) => button.label === "Downgrade to 2.5.0")!.action!();

    expect(updater.downloadDowngrade).toHaveBeenCalledWith(false);
  });

  it("presents a confirmed downgrade as a downgrade, then as ready on restart", async () => {
    const { sendNotification, pushState } = await setup();

    await pushState({
      type: "downloading",
      version: "2.5.0",
      kind: "downgrade",
      manual: true,
      percent: 12,
    });

    let updates = sent(sendNotification, "vortex-update-available");
    expect(updates[0]!.message).toBe("Downgrading to Vortex 2.5.0 (12%)");
    expect(updates[0]!.actions).toBeUndefined();

    // once staged it installs on quit, like a patch, and says so
    await pushState({ type: "staged", version: "2.5.0", kind: "downgrade" });
    updates = sent(sendNotification, "vortex-update-available");
    const last = updates.at(-1)!;
    expect(last.message).toBe("Vortex will update on restart");
    expect(last.actions!.map((action) => action.title)).toEqual(["Restart Now"]);
  });

  // Review finding: when main retracts an offer (failed downgrade, release
  // pulled from the feed), the standing notification kept dead buttons.
  it("withdraws standing notifications when nothing is on offer any more", async () => {
    const { notifications, pushState } = await setup();

    await pushState({ type: "downgrade-offered", version: "2.5.0" });
    expect(notifications.some((entry) => entry.id === "vortex-downgrade-offer")).toBe(true);

    await pushState({ type: "idle" });
    expect(notifications).toHaveLength(0);

    // and the next offer still shows
    await pushState({ type: "downgrade-offered", version: "2.5.0" });
    expect(notifications.some((entry) => entry.id === "vortex-downgrade-offer")).toBe(true);
  });
});

describe("post-update notice", () => {
  it("shows a one-time 'was updated' notice on the first launch after an update", async () => {
    const { sendNotification, pushState } = await setup();

    await pushState({ type: "idle" }, "2.5.9");
    await pushState({ type: "idle" }, "2.5.9");

    const updated = sent(sendNotification, "vortex-updated");
    expect(updated).toHaveLength(1);
    expect(updated[0]!.message).toContain("was updated to 2.6.0-beta.1");
    expect(updated[0]!.actions![0]!.title).toBe("View changes");
  });

  it("dismisses the 'was updated' notice when an update notification appears", async () => {
    const { notifications, pushState } = await setup();

    await pushState({ type: "idle" }, "2.5.9");
    expect(notifications.some((entry) => entry.id === "vortex-updated")).toBe(true);

    await pushState({ type: "available", version: "2.7.0" }, "2.5.9");
    expect(notifications.some((entry) => entry.id === "vortex-updated")).toBe(false);
    expect(notifications.some((entry) => entry.id === "vortex-update-available")).toBe(true);
  });
});

describe("periodic checks", () => {
  it("re-checks periodically so long sessions hear about updates", async () => {
    const { updater } = await setup();
    updater.checkForUpdates.mockClear();

    await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000);
    expect(updater.checkForUpdates).toHaveBeenCalledWith("stable", false);

    await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });
});

describe("analytics", () => {
  function collect(context: IExtensionContext): MixpanelEvent[] {
    const events: MixpanelEvent[] = [];
    context.api.events.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
    return events;
  }

  it("emits the funnel from transitions, once per transition (no ticks, no re-renders)", async () => {
    const { context, pushState } = await setup();
    const events = collect(context);

    await pushState({ type: "checking", manual: true });
    await pushState({ type: "available", version: "2.7.0" });
    await pushState({ type: "available", version: "2.7.0" });
    await pushState({
      type: "downloading",
      version: "2.7.0",
      kind: "update",
      manual: true,
      percent: 10,
    });
    await pushState({
      type: "downloading",
      version: "2.7.0",
      kind: "update",
      manual: true,
      percent: 50,
    });
    await pushState({ type: "staged", version: "2.7.0", kind: "update" });

    expect(events.map((e) => e.eventName)).toEqual([
      "app_update_check_completed",
      "app_update_offered",
      "app_update_download_started",
      "app_update_download_completed",
    ]);
    expect(events.every((e) => e.properties.update_channel === "stable")).toBe(true);
  });

  it("emits install_started from Restart Now and app_updated from the post-update notice", async () => {
    const { context, sendNotification, pushState } = await setup();
    const events = collect(context);

    await pushState({ type: "staged", version: "2.7.0", kind: "update" }, "2.5.9");
    const staged = sent(sendNotification, "vortex-update-available").at(-1)!;
    staged.actions!.find((a) => a.title === "Restart Now")!.action(() => undefined);

    const names = events.map((e) => e.eventName);
    expect(names).toContain("app_updated");
    expect(names).toContain("app_update_install_started");
    const install = events.find((e) => e.eventName === "app_update_install_started")!;
    expect(install.properties).toMatchObject({ to_version: "2.7.0", source: "notification" });
    const updated = events.find((e) => e.eventName === "app_updated")!;
    expect(updated.properties).toMatchObject({ from_version: "2.5.9", to_version: "2.6.0-beta.1" });
  });
});

import type { UpdaterSnapshot, UpdaterState, UpdaterStatusResponse } from "@vortex/shared/ipc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ResolvedRelease } from "./releaseResolver";

const {
  autoUpdaterMock,
  appMock,
  ipcMock,
  resolveUpdateMock,
  writePersistedValueMock,
  readPersistedValueMock,
} = vi.hoisted(() => {
  return {
    autoUpdaterMock: {
      on: vi.fn(),
      setFeedURL: vi.fn(),
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      quitAndInstall: vi.fn(),
      allowDowngrade: true,
      autoDownload: true,
      autoInstallOnAppQuit: true,
      forceDevUpdateConfig: false,
    },
    appMock: {
      getVersion: vi.fn(() => "2.6.0"),
      on: vi.fn(),
      removeListener: vi.fn(),
      isPackaged: true,
    },
    ipcMock: { handle: vi.fn(), on: vi.fn(), send: vi.fn() },
    resolveUpdateMock: vi.fn(),
    writePersistedValueMock: vi.fn(),
    readPersistedValueMock: vi.fn(),
  };
});

// @vortex/shared's error module has a duplicate-load guard that trips under
// vi.resetModules; only these two helpers are used at runtime (the type
// imports are compile-time only and erased).
vi.mock("@vortex/shared", () => ({
  getErrorMessageOrDefault: (err: unknown) => (err instanceof Error ? err.message : String(err)),
  unknownToError: (err: unknown) => (err instanceof Error ? err : new Error(String(err))),
}));
vi.mock("electron", () => ({
  app: appMock,
  dialog: { showMessageBoxSync: vi.fn() },
}));
vi.mock("electron-updater", () => ({ autoUpdater: autoUpdaterMock }));
vi.mock("../../ipc", () => ({ betterIpcMain: ipcMock }));
vi.mock("../../logging", () => ({ log: vi.fn() }));
vi.mock("../../store/mainPersistence", () => ({
  writePersistedValue: writePersistedValueMock,
  readPersistedValue: readPersistedValueMock,
}));
vi.mock("./releaseResolver", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveUpdate: resolveUpdateMock,
}));

function resolved(overrides: Partial<ResolvedRelease> = {}): ResolvedRelease {
  const tag = overrides.tag ?? "v2.7.0";
  return {
    tag,
    version: tag.replace(/^v/, ""),
    prerelease: false,
    downloadBaseUrl: `https://github.com/Nexus-Mods/Vortex/releases/download/${tag}`,
    notesHtml: "<p>notes</p>",
    ...overrides,
  };
}

function ipcHandler(channel: string): (...args: unknown[]) => unknown {
  const call = ipcMock.on.mock.calls.find(([name]) => name === channel);
  expect(call, `ipc handler ${channel} registered`).toBeDefined();
  return call![1] as (...args: unknown[]) => unknown;
}

function updaterEvent(name: string): ((...args: unknown[]) => void) | undefined {
  const call = autoUpdaterMock.on.mock.calls.find(([event]) => event === name);
  return call?.[1] as ((...args: unknown[]) => void) | undefined;
}

function getStatus(since?: number): UpdaterStatusResponse {
  const call = ipcMock.handle.mock.calls.find(([name]) => name === "updater:get-status");
  return (call![1] as (event: unknown, since?: number) => UpdaterStatusResponse)({}, since);
}

function getSnapshot(): UpdaterSnapshot {
  return getStatus().snapshot;
}

function getState(): UpdaterState {
  return getSnapshot().state;
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

async function setup(installType = "regular"): Promise<void> {
  const { setupAutoUpdater } = await import("./index");
  setupAutoUpdater(installType);
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  appMock.getVersion.mockReturnValue("2.6.0");
  autoUpdaterMock.checkForUpdates.mockResolvedValue({ cancellationToken: { cancel: vi.fn() } });
  autoUpdaterMock.downloadUpdate.mockResolvedValue([]);
  writePersistedValueMock.mockResolvedValue(undefined);
  readPersistedValueMock.mockResolvedValue(null);
  // start from the real post-init state so assertions on the flag observe
  // the handlers, not setupAutoUpdater's initialization
  autoUpdaterMock.allowDowngrade = false;
  autoUpdaterMock.forceDevUpdateConfig = false;
  appMock.isPackaged = true;
  // a developer machine may have the dev-updater opt-in persisted in the
  // user environment; tests must never depend on ambient env
  vi.stubEnv("VORTEX_DEV_UPDATER", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("checkForUpdates", () => {
  // Regression pin for the field bug: a release that is older than the
  // running version (published later in time) must never become an update.
  it("ignores a resolved release older than the running version", async () => {
    await setup();
    // establish a known update first so the assertion pins an actual reset
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.9.9" }));
    ipcHandler("updater:check-for-updates")(undefined, "beta", false);
    await flush();
    expect(getState()).toMatchObject({ type: "available", version: "2.9.9" });
    autoUpdaterMock.setFeedURL.mockClear();
    autoUpdaterMock.downloadUpdate.mockClear();

    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.4.2", version: "2.4.2" }));
    ipcHandler("updater:check-for-updates")(undefined, "beta", false);
    await flush();

    expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalled();
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
    expect(getState().type).toBe("idle");
  });

  // Regression pin #23132: equal version must not trigger a spurious download.
  it("reports idle when the resolved version equals the current one", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.0", version: "2.6.0" }));

    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();

    expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalled();
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
    expect(getState().type).toBe("idle");
  });

  it("points the generic feed at the resolved release for an upgrade", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved());

    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();

    expect(autoUpdaterMock.setFeedURL).toHaveBeenCalledWith({
      provider: "generic",
      useMultipleRangeRequest: false,
      url: "https://github.com/Nexus-Mods/Vortex/releases/download/v2.7.0",
    });
    expect(autoUpdaterMock.checkForUpdates).toHaveBeenCalled();
    // minor upgrade: no auto-download, waits for the user
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
    expect(getState()).toMatchObject({ type: "available", version: "2.7.0" });
  });

  it("carries the resolver's release notes on the available state", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ notesHtml: "<p>from resolver</p>" }));

    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();

    expect(getState()).toMatchObject({
      type: "available",
      releaseNotes: "<p>from resolver</p>",
    });
  });

  // Regression pin #22609: patch updates auto-download.
  it("auto-downloads patch upgrades for regular installs", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1", version: "2.6.1" }));

    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();

    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled();
    expect(getState()).toMatchObject({ type: "downloading", version: "2.6.1", kind: "patch" });
  });

  it("exposes manual checks as a manual checking state", async () => {
    await setup();
    let release: (value: unknown) => void = () => undefined;
    resolveUpdateMock.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    ipcHandler("updater:check-for-updates")(undefined, "stable", true);
    expect(getState()).toMatchObject({ type: "checking", manual: true });

    release(resolved({ tag: "v2.6.0", version: "2.6.0" }));
    await flush();
    expect(getState().type).toBe("idle");
  });

  it("never resolves when the channel is none", async () => {
    await setup();
    ipcHandler("updater:check-for-updates")(undefined, "none", false);
    await flush();
    expect(resolveUpdateMock).not.toHaveBeenCalled();
  });

  // Review finding: disabling updates left the previous offer advertised.
  it("withdraws the current offer when the channel is set to none", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved());
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    expect(getState().type).toBe("available");
    const before = getStatus().seq;

    ipcHandler("updater:set-channel")(undefined, "none", true);

    expect(getState().type).toBe("disabled");
    // the withdrawal is a recorded transition, so the renderer's next poll
    // sees it and dismisses
    expect(getStatus(before).changes.map((entry) => entry.state.type)).toEqual(["disabled"]);
  });

  it("restores what the user could see when a background check fails", async () => {
    await setup();
    // a previously known update survives an offline/failed check
    resolveUpdateMock.mockResolvedValue(resolved());
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    expect(getState()).toMatchObject({ type: "available", version: "2.7.0" });

    resolveUpdateMock.mockRejectedValue(new Error("network down"));
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();

    // offline is normal: no error state for a BACKGROUND check (it would
    // raise a red notification every launch and 4h tick)
    expect(getState()).toMatchObject({ type: "available", version: "2.7.0" });
  });

  it("surfaces a failed MANUAL check as an error state", async () => {
    await setup();
    resolveUpdateMock.mockRejectedValue(new Error("network down"));

    ipcHandler("updater:check-for-updates")(undefined, "stable", true);
    await flush();

    // a failed manual check must not read as "up to date"
    expect(getState()).toMatchObject({ type: "error", manual: true });
  });
});

describe("updater:download", () => {
  it("resolves the feed first when no prior check ran", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved());

    ipcHandler("updater:download")(undefined, "stable", false);
    await flush();

    expect(resolveUpdateMock).toHaveBeenCalled();
    expect(autoUpdaterMock.setFeedURL).toHaveBeenCalledWith({
      provider: "generic",
      useMultipleRangeRequest: false,
      url: "https://github.com/Nexus-Mods/Vortex/releases/download/v2.7.0",
    });
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled();
  });

  // Regression pin: a download must resolve for the channel it was asked
  // about, a cached resolution from another channel must never be reused.
  it("re-resolves for the requested channel on every download", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(
      resolved({ tag: "v2.8.0-beta.1", version: "2.8.0-beta.1" }),
    );
    ipcHandler("updater:check-for-updates")(undefined, "beta", false);
    await flush();
    resolveUpdateMock.mockClear();
    autoUpdaterMock.setFeedURL.mockClear();
    resolveUpdateMock.mockResolvedValue(resolved());

    ipcHandler("updater:download")(undefined, "stable", false);
    await flush();

    expect(resolveUpdateMock).toHaveBeenCalledWith("stable", "2.6.0");
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled();
  });

  // A user download is always presented as a regular update, even when the
  // version is patch-sized, the silent patch flow is auto-download only.
  it("downloads user requests as regular updates", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1", version: "2.6.1" }));
    // pre-existing patch auto-download would have consumed it; simulate the
    // user pressing Download from an error-retry
    ipcHandler("updater:download")(undefined, "stable", false);
    await flush();

    expect(getState()).toMatchObject({ type: "downloading", kind: "update" });
  });

  it("skips re-download and installs directly when already staged", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved());
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    updaterEvent("update-downloaded")?.({ version: "2.7.0" });
    expect(getState()).toMatchObject({ type: "staged", version: "2.7.0" });
    autoUpdaterMock.downloadUpdate.mockClear();

    ipcHandler("updater:download")(undefined, "stable", true);
    await flush();

    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalled();
  });

  it("does not short-circuit a download when the staged installer is a different version", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1", version: "2.6.1" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    updaterEvent("update-downloaded")?.({ version: "2.6.1" });

    // a newer beta is now advertised; downloading must re-fetch, not install
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.8.0-beta.1", prerelease: true }));
    ipcHandler("updater:check-for-updates")(undefined, "beta", false);
    await flush();
    autoUpdaterMock.quitAndInstall.mockClear();
    autoUpdaterMock.downloadUpdate.mockClear();

    ipcHandler("updater:download")(undefined, "beta", true);
    await flush();

    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled();
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled();
  });

  // Review finding: a failed download left stale progress, stranding the
  // renderer on "Downloading..." with the retry hidden. The error state now
  // carries the still-known update for a working retry.
  it("fails a download into an error state that carries a retry", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved());
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();

    autoUpdaterMock.downloadUpdate.mockRejectedValue(new Error("net::ERR_CONNECTION_REFUSED"));
    ipcHandler("updater:download")(undefined, "stable", false);
    await flush();

    expect(getState()).toMatchObject({
      type: "error",
      manual: true,
      retry: { version: "2.7.0" },
    });
  });

  // Review finding: a download that lost the generation race could still call
  // downloadUpdate, potentially while a confirmed downgrade's temporarily
  // raised allowDowngrade was in effect.
  it("does not download when superseded by a newer check", async () => {
    await setup();
    let resolveFirst: (value: unknown) => void = () => undefined;
    resolveUpdateMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );

    ipcHandler("updater:download")(undefined, "stable", false);

    // a newer manual check supersedes the download's generation (2.7.0 is a
    // minor upgrade, so the check itself won't auto-download)
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.7.0" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", true);
    await flush();
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();

    resolveFirst(resolved({ tag: "v2.7.0" }));
    await flush();

    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
  });
});

describe("library events", () => {
  it("tracks progress as whole-percent downloading updates", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1", version: "2.6.1" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    const before = getStatus().seq;

    updaterEvent("download-progress")?.({ percent: 41.2 });
    updaterEvent("download-progress")?.({ percent: 41.9 });
    updaterEvent("download-progress")?.({ percent: 42.1 });

    expect(getState()).toMatchObject({ type: "downloading", percent: 42 });
    // 41.2 and 42.1 are recorded; 41.9 is the same whole percent as 41.2
    expect(getStatus(before).changes.map((entry) => entry.state)).toMatchObject([
      { percent: 41 },
      { percent: 42 },
    ]);
  });

  it("stages the download and arms a VISIBLE install-on-quit", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1", version: "2.6.1" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();

    updaterEvent("update-downloaded")?.({ version: "2.6.1" });

    expect(getState()).toMatchObject({ type: "staged", version: "2.6.1", kind: "patch" });
    // never the library's silent /S quit-install path
    expect(autoUpdaterMock.autoInstallOnAppQuit).toBe(false);
    // our quit hook runs the same visible install as Restart Now
    const quitHook = appMock.on.mock.calls.find(([event]) => event === "before-quit");
    expect(quitHook).toBeDefined();
    (quitHook![1] as () => void)();
    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it("does not install a stale staged installer on quit", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1", version: "2.6.1" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    updaterEvent("update-downloaded")?.({ version: "2.6.1" });

    // a newer version is advertised since; the staged 2.6.1 is no longer what
    // the user was told about
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.7.0" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    expect(getState()).toMatchObject({ type: "available", version: "2.7.0" });

    const quitHook = appMock.on.mock.calls.find(([event]) => event === "before-quit");
    (quitHook![1] as () => void)();

    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled();
  });

  // A channel flip and back must not forget an installer already on disk.
  it("re-checks land on staged when the resolved version is already downloaded", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved());
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    updaterEvent("update-downloaded")?.({ version: "2.7.0" });

    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();

    expect(getState()).toMatchObject({ type: "staged", version: "2.7.0" });
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
  });

  // Funnel protection: a patch whose auto-download just failed is not
  // re-fetched by every subsequent check; it is offered as a downloadable
  // update instead, and a user-initiated download may retry immediately.
  it("holds a failed patch auto-download and offers it instead", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1", version: "2.6.1" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    expect(getState().type).toBe("downloading");

    updaterEvent("error")?.(new Error("net::ERR_CONNECTION_REFUSED"));
    // the failed patch keeps a working Download via retry
    expect(getState()).toMatchObject({ type: "error", retry: { version: "2.6.1" } });
    autoUpdaterMock.downloadUpdate.mockClear();

    // the next background check does NOT re-download; it offers
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
    expect(getState()).toMatchObject({ type: "available", version: "2.6.1" });

    // a user-initiated download bypasses the hold
    ipcHandler("updater:download")(undefined, "stable", false);
    await flush();
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled();
  });

  it("fails an active download into an error state via the error event", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1", version: "2.6.1" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    expect(getState().type).toBe("downloading");

    updaterEvent("error")?.(new Error("net::ERR_CONNECTION_REFUSED"));

    expect(getState()).toMatchObject({ type: "error", manual: true });
  });

  // Review finding: cancelling a download (channel switch) surfaced as a red
  // error notification for a deliberate user action.
  it("does not surface a cancelled download as an error", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1", version: "2.6.1" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();

    const cancellation = new Error("cancelled");
    cancellation.name = "CancellationError";
    updaterEvent("error")?.(cancellation);

    expect(getState().type).toBe("idle");
  });
});

describe("downgrade offers", () => {
  it("offers a downgrade for a switch to stable on a prerelease build", async () => {
    appMock.getVersion.mockReturnValue("2.6.0-beta.1");
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.5.0", version: "2.5.0" }));

    ipcHandler("updater:set-channel")(undefined, "stable", true);
    await flush();

    expect(getState()).toMatchObject({ type: "downgrade-offered", version: "2.5.0" });
    // nothing downloads until the user confirms
    expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalled();
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
  });

  // Field report: the offer showed on plain app launch. Downgrades must only
  // ever be offered on a purposeful switch to stable, never from the launch
  // sync, Check now, or the periodic re-check.
  it("never offers a downgrade on a background channel sync", async () => {
    appMock.getVersion.mockReturnValue("2.6.0-beta.1");
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.5.0", version: "2.5.0" }));

    // the 5s launch fallback sends manual=false
    ipcHandler("updater:set-channel")(undefined, "stable", false);
    await flush();
    expect(getState().type).toBe("idle");

    // Check now on the stable channel doesn't offer either
    ipcHandler("updater:check-for-updates")(undefined, "stable", true);
    await flush();
    expect(getState().type).toBe("idle");
  });

  it("declining clears the offer until the next switch to stable", async () => {
    appMock.getVersion.mockReturnValue("2.6.0-beta.1");
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.5.0", version: "2.5.0" }));
    ipcHandler("updater:set-channel")(undefined, "stable", true);
    await flush();

    ipcHandler("updater:decline-downgrade")(undefined);

    expect(getState().type).toBe("idle");

    // the declined offer is consumed: a late confirm must not download
    ipcHandler("updater:download-downgrade")(undefined, true);
    await flush();
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();

    // ...but another purposeful switch to stable raises it again
    ipcHandler("updater:set-channel")(undefined, "stable", true);
    await flush();
    expect(getState().type).toBe("downgrade-offered");
  });

  it("ignores a decline when no offer is outstanding", async () => {
    await setup();
    const before = getStatus().seq;

    ipcHandler("updater:decline-downgrade")(undefined);

    expect(getState().type).toBe("idle");
    // no spurious transition recorded for a stray decline
    expect(getStatus(before).changes).toEqual([]);
  });

  it("ignores download-downgrade when no offer is outstanding", async () => {
    await setup();

    ipcHandler("updater:download-downgrade")(undefined, true);
    await flush();

    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
    expect(autoUpdaterMock.allowDowngrade).toBe(false);
  });

  it("downloads a confirmed downgrade with allowDowngrade raised only for the feed apply", async () => {
    appMock.getVersion.mockReturnValue("2.6.0-beta.1");
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.5.0", version: "2.5.0" }));
    ipcHandler("updater:set-channel")(undefined, "stable", true);
    await flush();

    // observe the flag at the moment the feed is applied
    let allowDowngradeDuringFeedApply: boolean | undefined;
    autoUpdaterMock.setFeedURL.mockImplementation(() => {
      allowDowngradeDuringFeedApply = autoUpdaterMock.allowDowngrade;
    });

    ipcHandler("updater:download-downgrade")(undefined, false);
    await flush();

    expect(autoUpdaterMock.setFeedURL).toHaveBeenCalledWith({
      provider: "generic",
      useMultipleRangeRequest: false,
      url: "https://github.com/Nexus-Mods/Vortex/releases/download/v2.5.0",
    });
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled();
    // raised for the feed apply, dropped again once the library accepted it
    expect(allowDowngradeDuringFeedApply).toBe(true);
    expect(autoUpdaterMock.allowDowngrade).toBe(false);
    // one-shot marker for the startup downgrade warning
    expect(writePersistedValueMock).toHaveBeenCalledWith("app", ["expectedDowngradeTo"], "2.5.0");
    // the flow is labeled a downgrade from the moment of the confirm
    expect(getState()).toMatchObject({ type: "downloading", kind: "downgrade" });

    // the label survives the download completing (the renderer's "update on
    // restart" wording depends on the staged kind)
    updaterEvent("update-downloaded")?.({ version: "2.5.0" });
    expect(getState()).toMatchObject({ type: "staged", version: "2.5.0", kind: "downgrade" });
  });

  // Field-tested: a manual check while a confirmed downgrade was staged
  // settled to idle, orphaning the downloaded installer and disarming its
  // install-on-quit. A confirmed downgrade survives checks that (correctly)
  // ignore the lower version.
  it("keeps a staged downgrade staged across checks", async () => {
    appMock.getVersion.mockReturnValue("2.6.0-beta.1");
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.5.0", version: "2.5.0" }));
    ipcHandler("updater:set-channel")(undefined, "stable", true);
    await flush();
    ipcHandler("updater:download-downgrade")(undefined, false);
    await flush();
    updaterEvent("update-downloaded")?.({ version: "2.5.0" });
    expect(getState()).toMatchObject({ type: "staged", kind: "downgrade" });

    // a manual re-check ignores the lower version, but must not forget the
    // staged downgrade the user already confirmed
    ipcHandler("updater:check-for-updates")(undefined, "stable", true);
    await flush();

    expect(getState()).toMatchObject({ type: "staged", version: "2.5.0", kind: "downgrade" });
  });

  it("consumes the offer on confirmation so a double-confirm is a no-op", async () => {
    appMock.getVersion.mockReturnValue("2.6.0-beta.1");
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.5.0", version: "2.5.0" }));
    ipcHandler("updater:set-channel")(undefined, "stable", true);
    await flush();

    ipcHandler("updater:download-downgrade")(undefined, true);
    await flush();
    ipcHandler("updater:download-downgrade")(undefined, true);
    await flush();

    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(writePersistedValueMock).toHaveBeenCalledTimes(1);
  });

  // Review finding: a failed downgrade download left the older version
  // advertised as a regular available update whose Download could only fail.
  it("fails a downgrade download into an error state without a retry", async () => {
    appMock.getVersion.mockReturnValue("2.6.0-beta.1");
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.5.0", version: "2.5.0" }));
    ipcHandler("updater:set-channel")(undefined, "stable", true);
    await flush();

    autoUpdaterMock.downloadUpdate.mockRejectedValue(new Error("sha512 mismatch"));
    ipcHandler("updater:download-downgrade")(undefined, false);
    await flush();

    const state = getState();
    expect(state).toMatchObject({ type: "error", manual: true });
    expect((state as { retry?: unknown }).retry).toBeUndefined();
    expect(autoUpdaterMock.allowDowngrade).toBe(false);
  });
});

describe("dev updater", () => {
  it("forces the dev update config only for unpackaged builds that opt in", async () => {
    appMock.isPackaged = false;
    vi.stubEnv("VORTEX_DEV_UPDATER", "1");
    await setup();
    expect(autoUpdaterMock.forceDevUpdateConfig).toBe(true);
  });

  it("stays off without the opt-in or in packaged builds", async () => {
    appMock.isPackaged = false;
    await setup();
    expect(autoUpdaterMock.forceDevUpdateConfig).toBe(false);

    vi.resetModules();
    appMock.isPackaged = true;
    vi.stubEnv("VORTEX_DEV_UPDATER", "1");
    await setup();
    expect(autoUpdaterMock.forceDevUpdateConfig).toBe(false);
  });

  it("never installs from an unpackaged build", async () => {
    appMock.isPackaged = false;
    vi.stubEnv("VORTEX_DEV_UPDATER", "1");
    await setup();

    ipcHandler("updater:restart-and-install")(undefined);

    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled();
  });
});

// Regression pin #23326: transient installer locks retry, hard errors give up.
describe("install retry", () => {
  it("retries quitAndInstall on EBUSY up to the cap", async () => {
    vi.useFakeTimers();
    await setup();
    autoUpdaterMock.quitAndInstall.mockImplementation(() => {
      throw new Error("spawn EBUSY");
    });

    ipcHandler("updater:restart-and-install")(undefined);
    for (let i = 0; i < 6; i += 1) {
      await vi.advanceTimersByTimeAsync(1000);
    }

    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledTimes(5);
    expect(getState()).toMatchObject({ type: "error", manual: true });
  });

  it("gives up immediately on a non-lock error", async () => {
    vi.useFakeTimers();
    await setup();
    autoUpdaterMock.quitAndInstall.mockImplementation(() => {
      throw new Error("catastrophic failure");
    });

    ipcHandler("updater:restart-and-install")(undefined);
    await vi.advanceTimersByTimeAsync(5000);

    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledTimes(1);
    expect(getState()).toMatchObject({ type: "error", message: "catastrophic failure" });
  });
});

// The persisted appVersion still holds the previous run's version at startup;
// an increase means this launch is the first after an update.
describe("post-update notice", () => {
  it("sets justUpdatedFrom when the app version increased since the last run", async () => {
    readPersistedValueMock.mockResolvedValue("2.5.9");
    await setup();
    await flush();

    expect(readPersistedValueMock).toHaveBeenCalledWith("app", ["appVersion"]);
    expect(getSnapshot().justUpdatedFrom).toBe("2.5.9");
  });

  it("stays unset for a same-version launch or after a downgrade", async () => {
    readPersistedValueMock.mockResolvedValue("2.6.0");
    await setup();
    await flush();
    expect(getSnapshot().justUpdatedFrom).toBeUndefined();

    vi.resetModules();
    readPersistedValueMock.mockResolvedValue("2.7.0");
    await setup();
    await flush();
    expect(getSnapshot().justUpdatedFrom).toBeUndefined();
  });

  it("serves the changelog for the versions the update covered", async () => {
    readPersistedValueMock.mockResolvedValue("2.5.9");
    await setup();
    await flush();
    resolveUpdateMock.mockResolvedValue(
      resolved({ tag: "v2.6.0", version: "2.6.0", notesHtml: "<p>2.6.0 changes</p>" }),
    );

    const call = ipcMock.handle.mock.calls.find(
      ([name]) => name === "updater:get-update-changelog",
    );
    expect(call).toBeDefined();
    await expect(
      (call![1] as (event: unknown, channel: string) => Promise<string | null>)(
        undefined,
        "stable",
      ),
    ).resolves.toBe("<p>2.6.0 changes</p>");
    // resolved from the pre-update version so the notes span the whole update
    expect(resolveUpdateMock).toHaveBeenCalledWith("stable", "2.5.9");
  });

  it("returns no changelog when the launch did not follow an update", async () => {
    await setup();
    await flush();

    const call = ipcMock.handle.mock.calls.find(
      ([name]) => name === "updater:get-update-changelog",
    );
    await expect(
      (call![1] as (event: unknown, channel: string) => Promise<string | null>)(
        undefined,
        "stable",
      ),
    ).resolves.toBeNull();
    expect(resolveUpdateMock).not.toHaveBeenCalled();
  });
});

describe("status polling", () => {
  // The renderer pulls status (like downloads and uploads). Because the UI
  // reacts to transitions, a poll carries the last sequence number it saw and
  // gets every snapshot since, so a short-lived state is never sampled past.
  it("replays every transition since the given sequence number, in order", async () => {
    await setup();
    const before = getStatus().seq;

    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.7.0", version: "2.7.0" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", true);
    await flush();

    const response = getStatus(before);
    expect(response.changes.map((entry) => entry.state.type)).toEqual(["checking", "available"]);
    expect(response.snapshot.state).toMatchObject({ type: "available", version: "2.7.0" });
    expect(response.seq).toBe(before + 2);
  });

  it("returns no changes when the caller is caught up, and none without a since", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.7.0", version: "2.7.0" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", true);
    await flush();

    const head = getStatus().seq;
    expect(getStatus(head).changes).toEqual([]);
    expect(getStatus().changes).toEqual([]);
    expect(getStatus().snapshot.state.type).toBe("available");
  });

  it("keeps a bounded history but always the latest snapshot", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1", version: "2.6.1" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    const before = getStatus().seq;

    for (let percent = 1; percent <= 60; percent += 1) {
      updaterEvent("download-progress")?.({ percent });
    }

    const response = getStatus(before);
    expect(response.changes.length).toBeLessThanOrEqual(32);
    expect(response.changes.at(-1)?.state).toMatchObject({ type: "downloading", percent: 60 });
    expect(response.snapshot.state).toMatchObject({ type: "downloading", percent: 60 });
    expect(response.seq).toBe(before + 60);
  });

  it("counts the post-update notice as a change so a poll picks it up", async () => {
    readPersistedValueMock.mockResolvedValue("2.5.9");
    await setup();
    await flush();

    const response = getStatus(0);
    expect(response.changes.some((entry) => entry.justUpdatedFrom === "2.5.9")).toBe(true);
    expect(response.snapshot.justUpdatedFrom).toBe("2.5.9");
  });
});

import type { UpdateStatus } from "@vortex/shared/ipc";
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
// vi.resetModules; only these two helpers are used at runtime (the UpdateStatus
// import is type-only and erased).
vi.mock("@vortex/shared", () => ({
  getErrorMessageOrDefault: (err: unknown) => (err instanceof Error ? err.message : String(err)),
  unknownToError: (err: unknown) => (err instanceof Error ? err : new Error(String(err))),
}));
vi.mock("electron", () => ({
  app: appMock,
  dialog: { showMessageBoxSync: vi.fn() },
  BrowserWindow: { getAllWindows: () => [{ webContents: {} }] },
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

function getStatus(): UpdateStatus {
  const call = ipcMock.handle.mock.calls.find(([name]) => name === "updater:get-status");
  return (call![1] as () => UpdateStatus)();
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
    // drive available to true first so the assertion pins an actual reset
    updaterEvent("update-available")?.({ version: "2.9.9", releaseNotes: null });
    expect(getStatus().available).toBe(true);
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.4.2", version: "2.4.2" }));

    ipcHandler("updater:check-for-updates")(undefined, "beta", false);
    await flush();

    expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalled();
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
    const status = getStatus();
    expect(status.available).toBe(false);
    expect(status.version).toBeUndefined();
    expect(status.checking).toBe(false);
  });

  // Regression pin #23132: equal version must not trigger a spurious download.
  it("reports no update when the resolved version equals the current one", async () => {
    await setup();
    updaterEvent("update-available")?.({ version: "2.9.9", releaseNotes: null });
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.0", version: "2.6.0" }));

    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();

    expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalled();
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
    expect(getStatus().available).toBe(false);
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
    // minor upgrade: no auto-download, and not labeled a patch
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
    expect(getStatus().patch).toBe(false);
  });

  // Regression pin #22609: patch updates auto-download.
  it("auto-downloads patch upgrades for regular installs", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1", version: "2.6.1" }));

    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();

    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled();
    // labeled for the renderer's quieter patch notification
    expect(getStatus().patch).toBe(true);
  });

  it("never resolves when the channel is none", async () => {
    await setup();
    ipcHandler("updater:check-for-updates")(undefined, "none", false);
    await flush();
    expect(resolveUpdateMock).not.toHaveBeenCalled();
  });

  it("clears checking but leaves availability untouched when resolution fails", async () => {
    await setup();
    // a previously known update survives an offline/failed check
    updaterEvent("update-available")?.({ version: "2.9.9", releaseNotes: null });
    resolveUpdateMock.mockRejectedValue(new Error("network down"));

    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();

    const status = getStatus();
    expect(status.checking).toBe(false);
    expect(status.available).toBe(true);
    expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalled();
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
  // about — a cached resolution from another channel must never be reused.
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
    expect(autoUpdaterMock.setFeedURL).toHaveBeenCalledWith({
      provider: "generic",
      useMultipleRangeRequest: false,
      url: "https://github.com/Nexus-Mods/Vortex/releases/download/v2.7.0",
    });
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled();
  });

  // Review finding: the download path used to inherit the patch label from
  // resolveAndApply, flipping a user-initiated download into the silent
  // patch presentation mid-flight.
  it("never labels a user-initiated download as a patch", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1", version: "2.6.1" }));

    ipcHandler("updater:download")(undefined, "stable", false);
    await flush();

    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled();
    expect(getStatus().patch).toBeUndefined();
  });

  // Review finding: a download that lost the generation race could still call
  // downloadUpdate — potentially while a confirmed downgrade's temporarily
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

  it("skips re-download and installs directly when already downloaded", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved());
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    updaterEvent("update-downloaded")?.({ version: "2.7.0" });

    ipcHandler("updater:download")(undefined, "stable", true);
    await flush();

    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
    // NODE_ENV=test: install proceeds via quitAndInstall
    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalled();
  });
});

describe("downloaded-state lifecycle", () => {
  // Field bug: 2.5.0 was downloaded on stable, then a beta switch advertised
  // 2.6.0-beta.1 with the stale downloaded flag — offering Restart & Install
  // for a build that isn't on disk.
  it("resets the downloaded flag when a different version becomes available", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    updaterEvent("update-available")?.({ version: "2.6.1", releaseNotes: null });
    updaterEvent("update-downloaded")?.({ version: "2.6.1" });
    expect(getStatus().downloaded).toBe(true);

    updaterEvent("update-available")?.({ version: "2.8.0-beta.1", releaseNotes: null });
    const afterSwitch = getStatus();
    expect(afterSwitch.version).toBe("2.8.0-beta.1");
    expect(afterSwitch.downloaded).toBe(false);

    // switching back to the version whose installer is on disk restores it
    updaterEvent("update-available")?.({ version: "2.6.1", releaseNotes: null });
    expect(getStatus().downloaded).toBe(true);
  });

  it("does not short-circuit a download when the disk installer is a different version", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();
    updaterEvent("update-available")?.({ version: "2.6.1", releaseNotes: null });
    updaterEvent("update-downloaded")?.({ version: "2.6.1" });

    // a newer beta is now advertised; downloading must re-fetch, not install 2.6.1
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.8.0-beta.1", prerelease: true }));
    updaterEvent("update-available")?.({ version: "2.8.0-beta.1", releaseNotes: null });
    ipcHandler("updater:download")(undefined, "beta", true);
    await flush();

    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled();
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled();
  });
});

describe("release notes", () => {
  it("prefers the resolver's collected notes over UpdateInfo", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ notesHtml: "<p>from resolver</p>" }));
    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();

    updaterEvent("update-available")?.({ version: "2.7.0", releaseNotes: null });

    expect(getStatus().releaseNotes).toBe("<p>from resolver</p>");
  });
});

describe("downgrade offers", () => {
  it("offers a downgrade for a switch to stable on a prerelease build", async () => {
    appMock.getVersion.mockReturnValue("2.6.0-beta.1");
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.5.0", version: "2.5.0" }));

    ipcHandler("updater:set-channel")(undefined, "stable", true);
    await flush();

    const status = getStatus();
    expect(status.available).toBe(true);
    expect(status.downgrade).toBe(true);
    expect(status.version).toBe("2.5.0");
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

    let status = getStatus();
    expect(status.downgrade).toBeUndefined();
    expect(status.available).toBe(false);

    // Check now on the stable channel doesn't offer either
    ipcHandler("updater:check-for-updates")(undefined, "stable", true);
    await flush();
    status = getStatus();
    expect(status.downgrade).toBeUndefined();
    expect(status.available).toBe(false);
  });

  it("declining clears the offer until the next switch to stable", async () => {
    appMock.getVersion.mockReturnValue("2.6.0-beta.1");
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.5.0", version: "2.5.0" }));
    ipcHandler("updater:set-channel")(undefined, "stable", true);
    await flush();

    ipcHandler("updater:decline-downgrade")(undefined);

    const status = getStatus();
    expect(status.available).toBe(false);
    expect(status.downgrade).toBeUndefined();
    expect(status.version).toBeUndefined();

    // the declined offer is consumed: a late confirm must not download
    ipcHandler("updater:download-downgrade")(undefined, true);
    await flush();
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();

    // ...but another purposeful switch to stable raises it again
    ipcHandler("updater:set-channel")(undefined, "stable", true);
    await flush();
    expect(getStatus().downgrade).toBe(true);
  });

  it("ignores a decline when no offer is outstanding", async () => {
    await setup();

    ipcHandler("updater:decline-downgrade")(undefined);

    expect(getStatus().available).toBe(false);
    // no spurious status broadcast for a stray decline
    expect(ipcMock.send).not.toHaveBeenCalled();
  });

  it("ignores download-downgrade when no offer is outstanding", async () => {
    await setup();

    ipcHandler("updater:download-downgrade")(undefined, true);
    await flush();

    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
    expect(autoUpdaterMock.allowDowngrade).toBe(false);
  });

  it("downloads a confirmed downgrade with allowDowngrade raised only for that flow", async () => {
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

    ipcHandler("updater:download-downgrade")(undefined, true);
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
    // past confirmation the offer flag drops, but the flow stays labeled as a
    // downgrade so the renderer never presents it as a regular update
    expect(getStatus().downgrade).toBeUndefined();
    expect(getStatus().downgrading).toBe(true);

    // the label survives the download completing (the renderer's "restarting
    // to install" message depends on downloaded + downgrading together)
    updaterEvent("update-downloaded")?.({ version: "2.5.0" });
    expect(getStatus().downgrading).toBe(true);
    expect(getStatus().downloaded).toBe(true);
  });

  // Review finding: a failed downgrade download left available:true with the
  // older version — the renderer then presented the downgrade as a regular
  // available update whose Download button could only ever fail.
  it("resets availability when the downgrade download fails", async () => {
    appMock.getVersion.mockReturnValue("2.6.0-beta.1");
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.5.0", version: "2.5.0" }));
    ipcHandler("updater:set-channel")(undefined, "stable", true);
    await flush();

    autoUpdaterMock.downloadUpdate.mockRejectedValue(new Error("sha512 mismatch"));
    ipcHandler("updater:download-downgrade")(undefined, false);
    await flush();

    const status = getStatus();
    expect(status.available).toBe(false);
    expect(status.version).toBeUndefined();
    expect(status.downgrading).toBeUndefined();
    expect(status.error).toContain("sha512");
    expect(autoUpdaterMock.allowDowngrade).toBe(false);
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
    expect(getStatus().error).toContain("EBUSY");
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
    expect(getStatus().error).toContain("catastrophic");
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
    expect(getStatus().justUpdatedFrom).toBe("2.5.9");
  });

  it("stays unset for a same-version launch or after a downgrade", async () => {
    readPersistedValueMock.mockResolvedValue("2.6.0");
    await setup();
    await flush();
    expect(getStatus().justUpdatedFrom).toBeUndefined();

    vi.resetModules();
    readPersistedValueMock.mockResolvedValue("2.7.0");
    await setup();
    await flush();
    expect(getStatus().justUpdatedFrom).toBeUndefined();
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
    await expect((call![1] as () => Promise<string | null>)()).resolves.toBe(
      "<p>2.6.0 changes</p>",
    );
    // resolved from the pre-update version so the notes span the whole update
    expect(resolveUpdateMock).toHaveBeenCalledWith("stable", "2.5.9");
  });

  it("returns no changelog when the launch did not follow an update", async () => {
    await setup();
    await flush();

    const call = ipcMock.handle.mock.calls.find(
      ([name]) => name === "updater:get-update-changelog",
    );
    await expect((call![1] as () => Promise<string | null>)()).resolves.toBeNull();
    expect(resolveUpdateMock).not.toHaveBeenCalled();
  });
});

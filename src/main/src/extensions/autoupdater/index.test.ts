import type { UpdateStatus } from "@vortex/shared/ipc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ResolvedRelease } from "./releaseResolver";

const { autoUpdaterMock, appMock, ipcMock, resolveUpdateMock, writePersistedValueMock } =
  vi.hoisted(() => {
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
      },
      appMock: {
        getVersion: vi.fn(() => "2.6.0"),
        on: vi.fn(),
        removeListener: vi.fn(),
      },
      ipcMock: { handle: vi.fn(), on: vi.fn(), send: vi.fn() },
      resolveUpdateMock: vi.fn(),
      writePersistedValueMock: vi.fn(),
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
vi.mock("../../store/mainPersistence", () => ({ writePersistedValue: writePersistedValueMock }));
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
});

afterEach(() => {
  vi.useRealTimers();
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
      url: "https://github.com/Nexus-Mods/Vortex/releases/download/v2.7.0",
    });
    expect(autoUpdaterMock.checkForUpdates).toHaveBeenCalled();
    // minor upgrade: no auto-download
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
  });

  // Regression pin #22609: patch updates auto-download.
  it("auto-downloads patch upgrades for regular installs", async () => {
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.6.1", version: "2.6.1" }));

    ipcHandler("updater:check-for-updates")(undefined, "stable", false);
    await flush();

    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled();
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
      url: "https://github.com/Nexus-Mods/Vortex/releases/download/v2.7.0",
    });
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled();
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
  it("offers a downgrade only for a manual switch to stable on a prerelease build", async () => {
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

  it("never offers a downgrade on a background channel sync", async () => {
    appMock.getVersion.mockReturnValue("2.6.0-beta.1");
    await setup();
    resolveUpdateMock.mockResolvedValue(resolved({ tag: "v2.5.0", version: "2.5.0" }));

    // the 5s fallback sends manual=false
    ipcHandler("updater:set-channel")(undefined, "stable", false);
    await flush();

    const status = getStatus();
    expect(status.downgrade).toBeUndefined();
    expect(status.available).toBe(false);
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

    ipcHandler("updater:download-downgrade")(undefined, true);
    await flush();

    expect(autoUpdaterMock.setFeedURL).toHaveBeenCalledWith({
      provider: "generic",
      url: "https://github.com/Nexus-Mods/Vortex/releases/download/v2.5.0",
    });
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled();
    // dropped again once the library accepted the feed
    expect(autoUpdaterMock.allowDowngrade).toBe(false);
    // one-shot marker for the startup downgrade warning
    expect(writePersistedValueMock).toHaveBeenCalledWith("app", ["expectedDowngradeTo"], "2.5.0");
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

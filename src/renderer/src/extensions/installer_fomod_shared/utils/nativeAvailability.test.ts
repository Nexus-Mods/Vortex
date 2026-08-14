import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";

// The warning is the only thing standing between a blocked addon and a silent
// run of mis-installed mods, so pin that it fires, that it fires once, and that
// its dialog is reachable.
describe("notifyNativeInstallerUnavailable", () => {
  const makeApi = () =>
    ({
      sendNotification: vi.fn(),
      showDialog: vi.fn(),
    }) as unknown as IExtensionApi;

  // Module-level `notified` latch: each test needs a fresh module instance.
  beforeEach(() => {
    vi.resetModules();
  });

  it("raises a warning notification", async () => {
    const { notifyNativeInstallerUnavailable } = await import("./nativeAvailability.js");
    const api = makeApi();

    notifyNativeInstallerUnavailable(api);

    expect(api.sendNotification).toHaveBeenCalledTimes(1);
    const notification = vi.mocked(api.sendNotification).mock.calls[0]![0];
    expect(notification.type).toBe("warning");
    expect(notification.id).toBe("fomod-native-unavailable");
  });

  it("only notifies once per session, however many installs are attempted", async () => {
    const { notifyNativeInstallerUnavailable } = await import("./nativeAvailability.js");
    const api = makeApi();

    notifyNativeInstallerUnavailable(api);
    notifyNativeInstallerUnavailable(api);
    notifyNativeInstallerUnavailable(api);

    expect(api.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("explains the cause through the notification action", async () => {
    const { notifyNativeInstallerUnavailable } = await import("./nativeAvailability.js");
    const api = makeApi();

    notifyNativeInstallerUnavailable(api);

    const notification = vi.mocked(api.sendNotification).mock.calls[0]![0];
    notification.actions![0]!.action(() => undefined);

    expect(api.showDialog).toHaveBeenCalledTimes(1);
    const [type, title, content] = vi.mocked(api.showDialog).mock.calls[0]!;
    expect(type).toBe("info");
    expect(title).toBe("FOMOD installer unavailable");
    expect(content.text).toContain("modinstaller.node");
  });
});

describe("isNativeInstallerAvailable", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("reports the addon as unavailable when it cannot be loaded", async () => {
    vi.doMock("@nexusmods/fomod-installer-native", () => {
      throw new Error("An Application Control policy has blocked this file.");
    });

    const { isNativeInstallerAvailable } = await import("./nativeAvailability.js");

    await expect(isNativeInstallerAvailable()).resolves.toBe(false);
  });

  it("probes only once and reuses the answer", async () => {
    const factory = vi.fn(() => {
      throw new Error("blocked");
    });
    vi.doMock("@nexusmods/fomod-installer-native", factory);

    const { isNativeInstallerAvailable } = await import("./nativeAvailability.js");

    await isNativeInstallerAvailable();
    await isNativeInstallerAvailable();

    expect(factory).toHaveBeenCalledTimes(1);
  });
});

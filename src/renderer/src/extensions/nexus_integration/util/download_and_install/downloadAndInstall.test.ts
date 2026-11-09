import { GameDomain, VortexGameId } from "@vortex/shared";
import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { downloadAndInstallNexusFile, downloadNexusFile } from "./downloadAndInstall";

const file = {
  gameDomain: GameDomain("skyrimspecialedition"),
  gameId: VortexGameId("skyrimse"),
  modId: "3863",
  fileId: "1000172397",
  name: "SkyUI",
};

/** An api whose download and install answer through their callbacks as given. */
const apiAnswering = (download: [Error | null, string?], install: [Error | null, string?]) => {
  const emit = vi.fn((event: string, ...args: unknown[]) => {
    if (event === "start-download") {
      (args[3] as (...answer: unknown[]) => void)(...download);
    }

    if (event === "start-install-download") {
      (args[2] as (...answer: unknown[]) => void)(...install);
    }
  });

  return { emit, api: { events: { emit } } as unknown as IExtensionApi };
};

describe("downloadAndInstallNexusFile", () => {
  it("downloads the file through its nxm link, then installs it enabled", async () => {
    const { emit, api } = apiAnswering([null, "download-1"], [null, "SkyUI-3863"]);

    await expect(downloadAndInstallNexusFile(api, file)).resolves.toBe("SkyUI-3863");

    expect(emit).toHaveBeenNthCalledWith(
      1,
      "start-download",
      ["nxm://skyrimspecialedition/mods/3863/files/1000172397"],
      { game: "skyrimse", name: "SkyUI", fileId: 1000172397, modId: 3863 },
      undefined,
      expect.any(Function),
      undefined,
      { allowInstall: false },
    );
    expect(emit).toHaveBeenNthCalledWith(
      2,
      "start-install-download",
      "download-1",
      { allowAutoEnable: true },
      expect.any(Function),
    );
  });

  it("rejects with the download's error, installing nothing", async () => {
    const error = new Error("offline");
    const { emit, api } = apiAnswering([error], [null, "SkyUI-3863"]);

    await expect(downloadAndInstallNexusFile(api, file)).rejects.toBe(error);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("rejects with the install's error", async () => {
    const error = new Error("disk full");
    const { api } = apiAnswering([null, "download-1"], [error]);

    await expect(downloadAndInstallNexusFile(api, file)).rejects.toBe(error);
  });

  it("only downloads the file, when asked to, resolving to the download", async () => {
    const { emit, api } = apiAnswering([null, "download-1"], [null, "SkyUI-3863"]);

    await expect(downloadNexusFile(api, file)).resolves.toBe("download-1");

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      "start-download",
      ["nxm://skyrimspecialedition/mods/3863/files/1000172397"],
      expect.anything(),
      undefined,
      expect.any(Function),
      undefined,
      { allowInstall: false },
    );
  });
});

import { VortexGameId } from "@vortex/shared";
import { VortexError } from "@vortex/shared/errors";
import type { TFunction } from "i18next";
import { describe, expect, it, vi } from "vitest";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";

import { installNexusFile, installsWhenDownloaded, reportInstallFailure } from "./installNexusFile";

const mocks = vi.hoisted(() => ({ install: vi.fn(), download: vi.fn() }));

vi.mock("@/extensions/nexus_integration/util/download_and_install/downloadAndInstall", () => ({
  downloadAndInstallNexusFile: mocks.install,
  downloadNexusFile: mocks.download,
}));

const mod = {
  id: "1704-12604",
  name: "SkyUI",
  game_scoped_id: "12604",
  game: { id: "1704", domain_name: "skyrimspecialedition", name: "Skyrim" },
} as unknown as ModSummary;

const api = { showErrorNotification: vi.fn() } as unknown as IExtensionApi;

const t = ((key: string, options?: { name?: string }) =>
  key.replace("{{name}}", options?.name ?? "")) as unknown as TFunction;

const nexusFile = {
  gameDomain: "skyrimspecialedition",
  gameId: "skyrimse",
  modId: "12604",
  fileId: "42",
  name: "SkyUI",
};

describe("installNexusFile", () => {
  it("downloads and installs the file when it should install", async () => {
    const gameId = VortexGameId("skyrimse");
    await installNexusFile(api, { mod, fileId: "42", gameId, shouldInstall: true });

    expect(mocks.install).toHaveBeenCalledWith(api, nexusFile);
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("only downloads the file when it shouldn't install", async () => {
    const gameId = VortexGameId("skyrimse");
    await installNexusFile(api, { mod, fileId: "42", gameId, shouldInstall: false });

    expect(mocks.download).toHaveBeenCalledWith(api, nexusFile);
  });
});

describe("reportInstallFailure", () => {
  it("tells the user an install failed, without offering to report it", () => {
    const error = new Error("disk full");
    reportInstallFailure(api, { t, mod, shouldInstall: true, error });

    expect(api.showErrorNotification).toHaveBeenCalledWith("Failed to install SkyUI", error, {
      allowReport: false,
    });
  });

  it("says download when it was only downloading", () => {
    const error = new Error("offline");
    reportInstallFailure(api, { t, mod, shouldInstall: false, error });

    expect(api.showErrorNotification).toHaveBeenCalledWith("Failed to download SkyUI", error, {
      allowReport: false,
    });
  });

  it.each(["user-canceled", "process-canceled"] as const)("stays quiet when %s", (kind) => {
    const notify = vi.fn();
    const error = new VortexError("canceled", { kind, skipped: false });
    reportInstallFailure({ showErrorNotification: notify } as unknown as IExtensionApi, {
      t,
      mod,
      shouldInstall: true,
      error,
    });

    expect(notify).not.toHaveBeenCalled();
  });
});

describe("installsWhenDownloaded", () => {
  it("reads the user's install-on-download setting", () => {
    const state = { settings: { automation: { install: true } } } as unknown as IState;

    expect(installsWhenDownloaded(state)).toBe(true);
  });
});

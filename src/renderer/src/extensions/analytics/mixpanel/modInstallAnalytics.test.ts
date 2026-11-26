/**
 * Unit tests for classifyInstallKind: how a mod install is labelled for the mods_installation_*
 * install_kind, given the mod being replaced (captured before removal) and the incoming file id.
 */
import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { makeMod } from "../../../test-utils/builders";

// Replaced whole: util and the nexus selectors import each other, so a partial mock leaves the
// selectors holding the real, empty games list.
vi.mock("../../nexus_integration/util", () => ({
  nexusGames: () => [{ id: 1303, domain_name: "stardewvalley" }],
}));

vi.mock("../../gamemode_management/util/getGame", () => ({
  getGame: (id: string) => ({ id, details: {} }),
}));

import { classifyInstallKind, emitModInstallStarted } from "./modInstallAnalytics";

describe("classifyInstallKind", () => {
  it("is fresh when there is no prior version", () => {
    expect(classifyInstallKind(undefined, 200)).toBe("fresh");
  });

  it("is reinstall when the same file id goes over itself", () => {
    expect(classifyInstallKind(makeMod({ attributes: { fileId: 200 } }), 200)).toBe("reinstall");
  });

  it("is version_update for a different file id", () => {
    expect(classifyInstallKind(makeMod({ attributes: { fileId: 150 } }), 200)).toBe(
      "version_update",
    );
  });

  it("is variant when the name conflict was resolved as a coexisting variant", () => {
    expect(classifyInstallKind(makeMod({ attributes: { fileId: 200 } }), 200, "variant")).toBe(
      "variant",
    );
  });

  it("is profile_replace when the name conflict was resolved as a replace", () => {
    expect(classifyInstallKind(makeMod({ attributes: { fileId: 150 } }), 200, "replace")).toBe(
      "profile_replace",
    );
  });
});

describe("emitModInstallStarted", () => {
  it("tracks an install from a download whose record names no Nexus game yet", () => {
    const emit = vi.fn();
    const api = {
      events: { emit },
      getState: () => ({
        persistent: {
          downloads: {
            files: {
              dl1: {
                game: ["stardewvalley"],
                modInfo: {
                  downloadSource: "browse",
                  nexus: { ids: { modId: 55894, fileId: 192243 } },
                },
              },
            },
          },
        },
      }),
    } as unknown as IExtensionApi;

    emitModInstallStarted(api, "dl1", "fresh");

    expect(emit).toHaveBeenCalledWith(
      "analytics-track-mixpanel-event",
      expect.objectContaining({
        eventName: "mods_installation_started",
        properties: expect.objectContaining({
          mod_id: "55894",
          game_id: 1303,
          download_source: "browse",
        }),
      }),
    );
  });
});

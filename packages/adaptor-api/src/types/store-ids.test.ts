import { describe, expect, it } from "vitest";
import {
  steamAppId,
  epicCatalogNamespace,
  epicCatalogItemId,
  gogGameId,
  xboxPackageFamilyName,
  nexusModsDomain,
  registryKey,
} from "./store-ids.js";

describe("steamAppId", () => {
  it("accepts a positive integer", () => {
    expect(steamAppId(72850)).toBe(72850);
  });

  it("rejects zero", () => {
    expect(() => steamAppId(0)).toThrow("Invalid SteamAppId");
  });

  it("rejects negative numbers", () => {
    expect(() => steamAppId(-1)).toThrow("Invalid SteamAppId");
  });

  it("rejects non-integers", () => {
    expect(() => steamAppId(1.5)).toThrow("Invalid SteamAppId");
  });
});

describe("epicCatalogNamespace", () => {
  it("accepts a hex string", () => {
    expect(epicCatalogNamespace("ac82db5035584c7f8a2c548d98c200a1")).toBe(
      "ac82db5035584c7f8a2c548d98c200a1",
    );
  });

  it("rejects empty string", () => {
    expect(() => epicCatalogNamespace("")).toThrow("Invalid EpicCatalogNamespace");
  });
});

describe("epicCatalogItemId", () => {
  it("accepts a hex string", () => {
    expect(epicCatalogItemId("d5241c76f17840b2953a9a6b76e6c890")).toBe(
      "d5241c76f17840b2953a9a6b76e6c890",
    );
  });

  it("rejects empty string", () => {
    expect(() => epicCatalogItemId("")).toThrow("Invalid EpicCatalogItemId");
  });
});

describe("gogGameId", () => {
  it("accepts a positive integer", () => {
    expect(gogGameId(1508702879)).toBe(1508702879);
  });

  it("rejects zero", () => {
    expect(() => gogGameId(0)).toThrow("Invalid GOGGameId");
  });

  it("rejects negative numbers", () => {
    expect(() => gogGameId(-1)).toThrow("Invalid GOGGameId");
  });
});

describe("xboxPackageFamilyName", () => {
  it("accepts a valid package family name", () => {
    expect(
      xboxPackageFamilyName("BethesdaSoftworks.SkyrimSE_3275kfvn8vcwc"),
    ).toBe("BethesdaSoftworks.SkyrimSE_3275kfvn8vcwc");
  });

  it("rejects empty string", () => {
    expect(() => xboxPackageFamilyName("")).toThrow(
      "Invalid XboxPackageFamilyName",
    );
  });
});

describe("nexusModsDomain", () => {
  it("accepts a valid domain slug", () => {
    expect(nexusModsDomain("skyrimspecialedition")).toBe(
      "skyrimspecialedition",
    );
  });

  it("rejects empty string", () => {
    expect(() => nexusModsDomain("")).toThrow("Invalid NexusModsDomain");
  });

  it("rejects strings with spaces", () => {
    expect(() => nexusModsDomain("skyrim special edition")).toThrow(
      "Invalid NexusModsDomain",
    );
  });
});

describe("registryKey", () => {
  it("accepts a valid HKEY_LOCAL_MACHINE key", () => {
    expect(
      registryKey(
        "HKEY_LOCAL_MACHINE\\SOFTWARE\\Bethesda Softworks\\Skyrim Special Edition",
      ),
    ).toBe(
      "HKEY_LOCAL_MACHINE\\SOFTWARE\\Bethesda Softworks\\Skyrim Special Edition",
    );
  });

  it("accepts a valid HKEY_CURRENT_USER key", () => {
    expect(
      registryKey("HKEY_CURRENT_USER\\SOFTWARE\\Valve\\Steam"),
    ).toBe("HKEY_CURRENT_USER\\SOFTWARE\\Valve\\Steam");
  });

  it("rejects key without valid HKEY_ root", () => {
    expect(() => registryKey("INVALID\\SOFTWARE\\Test")).toThrow(
      "Invalid RegistryKey",
    );
  });

  it("rejects key without backslash path", () => {
    expect(() => registryKey("HKEY_LOCAL_MACHINE")).toThrow(
      "Invalid RegistryKey",
    );
  });
});

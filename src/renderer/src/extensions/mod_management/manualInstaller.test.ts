import * as path from "node:path";

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { FlagService } from "../../FlagService";
import { getCollectionActiveSession } from "../../util/collectionInstallSessionSelectors";
import { UserCanceled } from "../../util/CustomErrors";
import { isTierZeroManagedGame } from "../gamemode_management/tiered/tierZero";
import {
  createManualInstaller,
  INSTALL_DESTINATION_ATTRIBUTE,
  normalizeDestination,
} from "./manualInstaller";

vi.mock("../../FlagService", () => ({ FlagService: { instance: { getFlag: vi.fn() } } }));
vi.mock("../gamemode_management/tiered/tierZero", () => ({ isTierZeroManagedGame: vi.fn() }));
vi.mock("../../util/collectionInstallSessionSelectors", () => ({
  getCollectionActiveSession: vi.fn(),
}));

const files = ["readme.txt", "sub" + path.sep, path.join("sub", "a.dll")];

const makeApi = (dialogResult?: { action: string; input: Record<string, string> }) => {
  const showDialog = vi.fn().mockResolvedValue(dialogResult);
  const api = {
    getState: () => ({}),
    showDialog,
    translate: (text: string) => text,
  } as unknown as IExtensionApi;
  return { api, showDialog };
};

const install = (
  installer: ReturnType<typeof createManualInstaller>,
  unattended?: boolean,
  previousAttributes?: Record<string, unknown>,
) =>
  installer.install(files, "", "game", () => undefined, undefined, unattended, undefined, {
    previousAttributes,
  });

const destinationOf = (result: Awaited<ReturnType<ReturnType<typeof install>["then"]>>) =>
  (result as any).instructions.find(
    (instr: { type: string; key?: string }) =>
      instr.type === "attribute" && instr.key === INSTALL_DESTINATION_ATTRIBUTE,
  )?.value;

beforeEach(() => {
  vi.mocked(FlagService.instance!.getFlag).mockReset();
  vi.mocked(isTierZeroManagedGame).mockReset();
  vi.mocked(getCollectionActiveSession).mockReset();
});

describe("normalizeDestination", () => {
  test("empty and blank mean the game root", () => {
    expect(normalizeDestination("")).toBe("");
    expect(normalizeDestination("  ")).toBe("");
    expect(normalizeDestination(".")).toBe("");
  });

  test("accepts either separator and trims trailing ones", () => {
    expect(normalizeDestination("Mods/My Mod/")).toBe(path.join("Mods", "My Mod"));
    expect(normalizeDestination("Mods\\My Mod")).toBe(path.join("Mods", "My Mod"));
  });

  test("rejects paths leaving the game root", () => {
    expect(normalizeDestination("..")).toBeUndefined();
    expect(normalizeDestination("a/../../b")).toBeUndefined();
    expect(normalizeDestination("/etc")).toBeUndefined();
    expect(normalizeDestination("\\Windows")).toBeUndefined();
    expect(normalizeDestination("C:\\Windows")).toBeUndefined();
  });
});

describe("testSupported", () => {
  const test_ = async (flag: boolean, tierZero: boolean) => {
    vi.mocked(FlagService.instance!.getFlag).mockReturnValue(flag ? ({} as any) : undefined);
    vi.mocked(isTierZeroManagedGame).mockReturnValue(tierZero);
    const { api } = makeApi();
    return (await createManualInstaller(api).testSupported(files, "game")).supported;
  };

  test("supported for a Tier 0 game with the flag on", async () => {
    expect(await test_(true, true)).toBe(true);
  });

  test("not supported for a game with an extension", async () => {
    expect(await test_(true, false)).toBe(false);
  });

  test("not supported with the flag off", async () => {
    expect(await test_(false, true)).toBe(false);
  });
});

describe("install", () => {
  test("unattended installs use the game root without asking", async () => {
    const { api, showDialog } = makeApi();
    const result = await install(createManualInstaller(api), true);

    expect(showDialog).not.toHaveBeenCalled();
    expect(destinationOf(result)).toBe("");
  });

  test("installs during a collection session use the game root without asking", async () => {
    vi.mocked(getCollectionActiveSession).mockReturnValue({} as any);
    const { api, showDialog } = makeApi();
    const result = await install(createManualInstaller(api));

    expect(showDialog).not.toHaveBeenCalled();
    expect(destinationOf(result)).toBe("");
  });

  test("reuses the previous destination without asking", async () => {
    const { api, showDialog } = makeApi();
    const result = await install(createManualInstaller(api), false, {
      [INSTALL_DESTINATION_ATTRIBUTE]: "Foo",
    });

    expect(showDialog).not.toHaveBeenCalled();
    expect(destinationOf(result)).toBe("Foo");
  });

  test("a previous destination at the game root is reused as well", async () => {
    const { api, showDialog } = makeApi();
    const result = await install(createManualInstaller(api), false, {
      [INSTALL_DESTINATION_ATTRIBUTE]: "",
    });

    expect(showDialog).not.toHaveBeenCalled();
    expect(destinationOf(result)).toBe("");
  });

  test("asks otherwise and places the files in the chosen folder", async () => {
    const { api, showDialog } = makeApi({ action: "Install", input: { folder: "Foo/Bar" } });
    const result = await install(createManualInstaller(api));

    expect(showDialog).toHaveBeenCalledOnce();
    const folder = path.join("Foo", "Bar");
    expect(destinationOf(result)).toBe(folder);
    expect((result as any).instructions.filter((i: any) => i.type === "copy")).toEqual([
      { type: "copy", source: "readme.txt", destination: path.join(folder, "readme.txt") },
      {
        type: "copy",
        source: path.join("sub", "a.dll"),
        destination: path.join(folder, "sub", "a.dll"),
      },
    ]);
  });

  test("an empty folder installs into the game root", async () => {
    const { api } = makeApi({ action: "Install", input: { folder: "" } });
    const result = await install(createManualInstaller(api));

    expect(destinationOf(result)).toBe("");
    expect((result as any).instructions[0].destination).toBe("readme.txt");
  });

  test("cancelling the dialog cancels the install", async () => {
    const { api } = makeApi({ action: "Cancel", input: {} });

    await expect(install(createManualInstaller(api))).rejects.toBeInstanceOf(UserCanceled);
  });
});

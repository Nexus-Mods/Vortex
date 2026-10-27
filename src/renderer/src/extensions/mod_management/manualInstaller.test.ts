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
import type { IModReference } from "./types/IMod";

vi.mock("../../FlagService", () => ({ FlagService: { instance: { getFlag: vi.fn() } } }));
vi.mock("../gamemode_management/tiered/tierZero", () => ({ isTierZeroManagedGame: vi.fn() }));
vi.mock("../../util/collectionInstallSessionSelectors", () => ({
  getCollectionActiveSession: vi.fn(),
}));
vi.mock("../nexus_integration/util/UIDs", () => ({
  makeModAndFileUIDs: (game: string, mod: string, file: string) =>
    Number.isNaN(parseInt(mod, 10))
      ? { modUID: undefined, fileUID: undefined }
      : { modUID: `${game}:${mod}`, fileUID: `${game}:${file}` },
}));

const files = ["readme.txt", "sub" + path.sep, path.join("sub", "a.dll")];

const makeApi = (dialogResult?: { action: string; input: Record<string, string> }) => {
  const showDialog = vi.fn().mockResolvedValue(dialogResult);
  const emit = vi.fn();
  const api = {
    getState: () => ({}),
    showDialog,
    translate: (text: string) => text,
    events: { emit },
  } as unknown as IExtensionApi;
  return { api, showDialog, emit };
};

const install = (
  installer: ReturnType<typeof createManualInstaller>,
  unattended?: boolean,
  previousAttributes?: Record<string, unknown>,
  modReference?: IModReference,
) =>
  installer.install(files, "", "game", () => undefined, undefined, unattended, undefined, {
    previousAttributes,
    modReference,
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

describe("analytics", () => {
  const reference = {
    repo: { repository: "nexus", modId: "518", fileId: "138454" },
  } as IModReference;

  test("a confirmed dialog reports completed with the uids", async () => {
    const { api, emit } = makeApi({ action: "Install", input: { folder: "Foo" } });
    await install(createManualInstaller(api), false, undefined, reference);

    expect(emit).toHaveBeenCalledExactlyOnceWith("analytics-track-mixpanel-event", {
      eventName: "app_manual_installer_closed",
      properties: { outcome: "completed", mod_uid: "game:518", file_uid: "game:138454" },
    });
  });

  test("a cancelled dialog reports cancelled", async () => {
    const { api, emit } = makeApi({ action: "Cancel", input: {} });
    await expect(
      install(createManualInstaller(api), false, undefined, reference),
    ).rejects.toBeInstanceOf(UserCanceled);

    expect(emit).toHaveBeenCalledExactlyOnceWith("analytics-track-mixpanel-event", {
      eventName: "app_manual_installer_closed",
      properties: { outcome: "cancelled", mod_uid: "game:518", file_uid: "game:138454" },
    });
  });

  test("ids are omitted when the archive has none", async () => {
    const { api, emit } = makeApi({ action: "Install", input: { folder: "" } });
    await install(createManualInstaller(api));

    expect(emit.mock.calls[0][1].properties).toEqual({ outcome: "completed" });
  });

  test("a file uid is never sent without a mod uid", async () => {
    const { api, emit } = makeApi({ action: "Install", input: { folder: "" } });
    await install(createManualInstaller(api), false, undefined, {
      repo: { repository: "nexus", modId: "x", fileId: "1" },
    } as IModReference);

    expect(emit.mock.calls[0][1].properties).toEqual({ outcome: "completed" });
  });

  test.each([
    ["unattended", true, undefined],
    ["reused destination", false, { [INSTALL_DESTINATION_ATTRIBUTE]: "Foo" }],
  ])("nothing is sent when the dialog isn't shown (%s)", async (_, unattended, previous) => {
    const { api, emit } = makeApi();
    await install(createManualInstaller(api), unattended, previous, reference);

    expect(emit).not.toHaveBeenCalled();
  });
});

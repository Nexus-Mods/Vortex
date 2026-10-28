import * as path from "node:path";

import { GameId } from "@vortex/shared";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IManualInstallerPreferences, ITierZeroGame } from "@/types/IState";

import { FlagService } from "../../FlagService";
import { getBatchContext, type IBatchContext } from "../../util/BatchContext";
import { getCollectionActiveSession } from "../../util/collectionInstallSessionSelectors";
import { UserCanceled } from "../../util/CustomErrors";
import { setManualInstallerPreferences } from "../gamemode_management/actions/persistent";
import { isTierZeroManagedGame, tierZeroGameFor } from "../gamemode_management/tiered/tierZero";
import {
  createManualInstaller,
  INSTALL_DESTINATION_ATTRIBUTE,
  INSTALL_SKIP_TOP_FOLDER_ATTRIBUTE,
  normalizeDestination,
} from "./manualInstaller";
import {
  requestManualInstallerDestination,
  type IManualInstallerAnswer,
} from "./manualInstallerQueue";
import type { IModReference } from "./types/IMod";

vi.mock("../../FlagService", () => ({ FlagService: { instance: { getFlag: vi.fn() } } }));
vi.mock("../gamemode_management/tiered/tierZero", () => ({
  isTierZeroManagedGame: vi.fn(),
  tierZeroGameFor: vi.fn(),
}));
vi.mock("../../util/collectionInstallSessionSelectors", () => ({
  getCollectionActiveSession: vi.fn(),
}));
vi.mock("../../util/BatchContext", () => ({ getBatchContext: vi.fn() }));
vi.mock("./manualInstallerQueue", () => ({ requestManualInstallerDestination: vi.fn() }));
vi.mock("../nexus_integration/util/UIDs", () => ({
  makeModAndFileUIDs: (game: string, mod: string, file: string) =>
    Number.isNaN(parseInt(mod, 10))
      ? { modUID: undefined, fileUID: undefined }
      : { modUID: `${game}:${mod}`, fileUID: `${game}:${file}` },
}));

const files = ["readme.txt", "sub" + path.sep, path.join("sub", "a.dll")];
const folderFiles = ["Top" + path.sep, path.join("Top", "a.dll"), path.join("Top", "b", "c.dll")];

const answer = (overrides: Partial<IManualInstallerAnswer> = {}): IManualInstallerAnswer => ({
  folder: "",
  skipTopFolder: false,
  useAsDefault: false,
  dontAskAgain: false,
  useForAll: false,
  ...overrides,
});

const makeApi = (dialogAnswer?: IManualInstallerAnswer) => {
  vi.mocked(requestManualInstallerDestination).mockResolvedValue(dialogAnswer);
  const emit = vi.fn();
  const dispatch = vi.fn();
  const api = {
    getState: () => ({}),
    store: { dispatch },
    events: { emit },
  } as unknown as IExtensionApi;
  return { api, emit, dispatch };
};

const makeBatch = (itemCount: number): IBatchContext => {
  const values = new Map<string, unknown>();
  return {
    itemCount,
    get: (name: string, fallback?: unknown) => (values.has(name) ? values.get(name) : fallback),
    set: (name: string, value: unknown) => {
      values.set(name, value);
    },
    onClose: vi.fn(),
  } as IBatchContext;
};

const withPreferences = (preferences: IManualInstallerPreferences) =>
  vi.mocked(tierZeroGameFor).mockReturnValue({
    gameId: GameId(1234),
    manualInstallerPreferences: preferences,
  } as ITierZeroGame);

interface IInstallOptions {
  unattended?: boolean;
  previousAttributes?: Record<string, unknown>;
  modReference?: IModReference;
  archiveId?: string;
  files?: string[];
}

const install = (installer: ReturnType<typeof createManualInstaller>, opts: IInstallOptions = {}) =>
  installer.install(
    opts.files ?? files,
    "",
    "game",
    () => undefined,
    undefined,
    opts.unattended,
    "mod.zip",
    {
      previousAttributes: opts.previousAttributes,
      modReference: opts.modReference,
      archiveId: opts.archiveId,
    },
  );

const attributeOf = (result: unknown, key: string) =>
  (result as any).instructions.find(
    (instr: { type: string; key?: string }) => instr.type === "attribute" && instr.key === key,
  )?.value;

const destinationOf = (result: unknown) => attributeOf(result, INSTALL_DESTINATION_ATTRIBUTE);

const copiesOf = (result: unknown) =>
  (result as any).instructions.filter((instr: { type: string }) => instr.type === "copy");

beforeEach(() => {
  vi.mocked(FlagService.instance!.getFlag).mockReset();
  vi.mocked(isTierZeroManagedGame).mockReset();
  vi.mocked(tierZeroGameFor).mockReset();
  vi.mocked(getCollectionActiveSession).mockReset();
  vi.mocked(getBatchContext).mockReset();
  vi.mocked(requestManualInstallerDestination).mockReset();
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
    const { api } = makeApi();
    const result = await install(createManualInstaller(api), { unattended: true });

    expect(requestManualInstallerDestination).not.toHaveBeenCalled();
    expect(destinationOf(result)).toBe("");
  });

  test("unattended installs use the default folder", async () => {
    withPreferences({ defaultFolder: "Mods" });
    const { api } = makeApi();
    const result = await install(createManualInstaller(api), { unattended: true });

    expect(requestManualInstallerDestination).not.toHaveBeenCalled();
    expect(destinationOf(result)).toBe("Mods");
  });

  test("installs during a collection session use the default folder without asking", async () => {
    vi.mocked(getCollectionActiveSession).mockReturnValue({} as any);
    withPreferences({ defaultFolder: "Mods" });
    const { api } = makeApi();
    const result = await install(createManualInstaller(api));

    expect(requestManualInstallerDestination).not.toHaveBeenCalled();
    expect(destinationOf(result)).toBe("Mods");
  });

  test("reuses the previous destination without asking", async () => {
    const { api } = makeApi();
    const result = await install(createManualInstaller(api), {
      previousAttributes: { [INSTALL_DESTINATION_ATTRIBUTE]: "Foo" },
    });

    expect(requestManualInstallerDestination).not.toHaveBeenCalled();
    expect(destinationOf(result)).toBe("Foo");
  });

  test("a previous destination at the game root is reused as well", async () => {
    const { api } = makeApi();
    const result = await install(createManualInstaller(api), {
      previousAttributes: { [INSTALL_DESTINATION_ATTRIBUTE]: "" },
    });

    expect(requestManualInstallerDestination).not.toHaveBeenCalled();
    expect(destinationOf(result)).toBe("");
  });

  test("a previous install that skipped the top folder skips it again", async () => {
    const { api } = makeApi();
    const result = await install(createManualInstaller(api), {
      files: folderFiles,
      previousAttributes: {
        [INSTALL_DESTINATION_ATTRIBUTE]: "Foo",
        [INSTALL_SKIP_TOP_FOLDER_ATTRIBUTE]: true,
      },
    });

    expect(copiesOf(result).map((copy: any) => copy.destination)).toEqual([
      path.join("Foo", "a.dll"),
      path.join("Foo", "b", "c.dll"),
    ]);
  });

  test("asks otherwise and places the files in the chosen folder", async () => {
    const { api } = makeApi(answer({ folder: "Foo/Bar" }));
    const result = await install(createManualInstaller(api));

    expect(requestManualInstallerDestination).toHaveBeenCalledOnce();
    const folder = path.join("Foo", "Bar");
    expect(destinationOf(result)).toBe(folder);
    expect(copiesOf(result)).toEqual([
      { type: "copy", source: "readme.txt", destination: path.join(folder, "readme.txt") },
      {
        type: "copy",
        source: path.join("sub", "a.dll"),
        destination: path.join(folder, "sub", "a.dll"),
      },
    ]);
  });

  test("an empty folder installs into the game root", async () => {
    const { api } = makeApi(answer());
    const result = await install(createManualInstaller(api));

    expect(destinationOf(result)).toBe("");
    expect(copiesOf(result)[0].destination).toBe("readme.txt");
  });

  test("skipping the top folder leaves it out of the final paths", async () => {
    const { api } = makeApi(answer({ folder: "Foo", skipTopFolder: true }));
    const result = await install(createManualInstaller(api), { files: folderFiles });

    expect(copiesOf(result).map((copy: any) => copy.destination)).toEqual([
      path.join("Foo", "a.dll"),
      path.join("Foo", "b", "c.dll"),
    ]);
    expect(attributeOf(result, INSTALL_SKIP_TOP_FOLDER_ATTRIBUTE)).toBe(true);
  });

  test("cancelling the dialog cancels the install", async () => {
    const { api } = makeApi(undefined);

    await expect(install(createManualInstaller(api))).rejects.toBeInstanceOf(UserCanceled);
  });
});

describe("per-game preferences", () => {
  test("the dialog preselects the default folder and offers the top folder and previews", async () => {
    withPreferences({ defaultFolder: "Mods" });
    const { api } = makeApi(answer({ folder: "Mods" }));
    await install(createManualInstaller(api), { files: folderFiles });

    expect(requestManualInstallerDestination).toHaveBeenCalledWith(
      api,
      expect.objectContaining({
        defaultFolder: "Mods",
        topFolder: "Top",
        previewFiles: [path.join("Top", "a.dll"), path.join("Top", "b", "c.dll")],
      }),
    );
  });

  test("a default folder alone doesn't skip the dialog", async () => {
    withPreferences({ defaultFolder: "Mods" });
    const { api } = makeApi(answer({ folder: "Other" }));
    const result = await install(createManualInstaller(api));

    expect(requestManualInstallerDestination).toHaveBeenCalledOnce();
    expect(destinationOf(result)).toBe("Other");
  });

  test("the dialog is skipped with a default folder and don't ask again", async () => {
    withPreferences({ defaultFolder: "Mods", dontAskAgain: true });
    const { api } = makeApi();
    const result = await install(createManualInstaller(api));

    expect(requestManualInstallerDestination).not.toHaveBeenCalled();
    expect(destinationOf(result)).toBe("Mods");
  });

  test("don't ask again without a default folder still asks", async () => {
    withPreferences({ dontAskAgain: true });
    const { api } = makeApi(answer());
    await install(createManualInstaller(api));

    expect(requestManualInstallerDestination).toHaveBeenCalledOnce();
  });

  test("using the folder as default saves the preferences", async () => {
    withPreferences({});
    const { api, dispatch } = makeApi(
      answer({ folder: "Mods", useAsDefault: true, dontAskAgain: true }),
    );
    await install(createManualInstaller(api));

    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
      setManualInstallerPreferences(GameId(1234), { defaultFolder: "Mods", dontAskAgain: true }),
    );
  });

  test("preferences are left alone otherwise", async () => {
    withPreferences({});
    const { api, dispatch } = makeApi(answer({ folder: "Mods" }));
    await install(createManualInstaller(api));

    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("batches", () => {
  test("the dialog reports how many installs of the batch remain", async () => {
    vi.mocked(getBatchContext).mockReturnValue(makeBatch(3));
    const { api } = makeApi(answer());
    const installer = createManualInstaller(api);

    await install(installer, { archiveId: "a" });
    await install(installer, { archiveId: "b" });

    const remaining = vi
      .mocked(requestManualInstallerDestination)
      .mock.calls.map(([, request]) => request.remaining);
    expect(remaining).toEqual([2, 1]);
  });

  test("using the folder for all skips the dialog for the rest of the batch", async () => {
    vi.mocked(getBatchContext).mockReturnValue(makeBatch(3));
    const { api } = makeApi(answer({ folder: "Foo", useForAll: true }));
    const installer = createManualInstaller(api);

    const first = await install(installer, { archiveId: "a" });
    const second = await install(installer, { archiveId: "b" });
    const third = await install(installer, { archiveId: "c" });

    expect(requestManualInstallerDestination).toHaveBeenCalledOnce();
    expect([first, second, third].map(destinationOf)).toEqual(["Foo", "Foo", "Foo"]);
  });

  test("without using the folder for all, every install asks", async () => {
    vi.mocked(getBatchContext).mockReturnValue(makeBatch(2));
    const { api } = makeApi(answer({ folder: "Foo" }));
    const installer = createManualInstaller(api);

    await install(installer, { archiveId: "a" });
    await install(installer, { archiveId: "b" });

    expect(requestManualInstallerDestination).toHaveBeenCalledTimes(2);
  });

  test("a cancelled install is no longer remaining", async () => {
    vi.mocked(getBatchContext).mockReturnValue(makeBatch(3));
    const { api } = makeApi(undefined);
    const installer = createManualInstaller(api);

    await expect(install(installer, { archiveId: "a" })).rejects.toBeInstanceOf(UserCanceled);
    vi.mocked(requestManualInstallerDestination).mockResolvedValue(answer());
    await install(installer, { archiveId: "b" });

    const remaining = vi
      .mocked(requestManualInstallerDestination)
      .mock.calls.map(([, request]) => request.remaining);
    expect(remaining).toEqual([2, 1]);
  });

  test("an install without a batch has nothing remaining", async () => {
    const { api } = makeApi(answer());
    await install(createManualInstaller(api));

    expect(requestManualInstallerDestination).toHaveBeenCalledWith(
      api,
      expect.objectContaining({ remaining: 0 }),
    );
  });
});

describe("analytics", () => {
  const reference = {
    repo: { repository: "nexus", modId: "518", fileId: "138454" },
  } as IModReference;

  test("a confirmed dialog reports completed with the uids", async () => {
    const { api, emit } = makeApi(answer({ folder: "Foo" }));
    await install(createManualInstaller(api), { modReference: reference });

    expect(emit).toHaveBeenCalledExactlyOnceWith("analytics-track-mixpanel-event", {
      eventName: "app_manual_installer_closed",
      properties: { outcome: "completed", mod_uid: "game:518", file_uid: "game:138454" },
    });
  });

  test("a cancelled dialog reports cancelled", async () => {
    const { api, emit } = makeApi(undefined);
    await expect(
      install(createManualInstaller(api), { modReference: reference }),
    ).rejects.toBeInstanceOf(UserCanceled);

    expect(emit).toHaveBeenCalledExactlyOnceWith("analytics-track-mixpanel-event", {
      eventName: "app_manual_installer_closed",
      properties: { outcome: "cancelled", mod_uid: "game:518", file_uid: "game:138454" },
    });
  });

  test("ids are omitted when the archive has none", async () => {
    const { api, emit } = makeApi(answer());
    await install(createManualInstaller(api));

    expect(emit.mock.calls[0][1].properties).toEqual({ outcome: "completed" });
  });

  test("a file uid is never sent without a mod uid", async () => {
    const { api, emit } = makeApi(answer());
    await install(createManualInstaller(api), {
      modReference: { repo: { repository: "nexus", modId: "x", fileId: "1" } } as IModReference,
    });

    expect(emit.mock.calls[0][1].properties).toEqual({ outcome: "completed" });
  });

  test.each([
    ["unattended", { unattended: true }],
    ["reused destination", { previousAttributes: { [INSTALL_DESTINATION_ATTRIBUTE]: "Foo" } }],
  ])("nothing is sent when the dialog isn't shown (%s)", async (_, opts) => {
    const { api, emit } = makeApi();
    await install(createManualInstaller(api), { ...opts, modReference: reference });

    expect(emit).not.toHaveBeenCalled();
  });

  test("nothing is sent when the dialog is skipped by the preferences", async () => {
    withPreferences({ defaultFolder: "Mods", dontAskAgain: true });
    const { api, emit } = makeApi();
    await install(createManualInstaller(api), { modReference: reference });

    expect(emit).not.toHaveBeenCalled();
  });
});

import type { types } from "@nexusmods/vortex-api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getGameVersion, updateInvalidatesMods } from "./gamesupport";
import { testGameVersions } from "./index";

vi.mock("./gamesupport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./gamesupport")>()),
  getGameVersion: vi.fn<typeof getGameVersion>(),
  updateInvalidatesMods: vi.fn<typeof updateInvalidatesMods>(),
}));

const GAME_ID = "testgame";

function makeApi(storedVersion: string | undefined, mods: Record<string, unknown> = {}) {
  let versions: Record<string, string> =
    storedVersion === undefined ? {} : { [GAME_ID]: storedVersion };
  const emit = vi.fn<(event: string, ...args: unknown[]) => boolean>();
  const api = {
    translate: (text: string) => text,
    events: { emit },
    store: {
      getState: () => ({
        settings: { profiles: { activeProfileId: "profile" } },
        persistent: {
          profiles: { profile: { id: "profile", gameId: GAME_ID } },
          mods: { [GAME_ID]: mods },
          gameMode: { versions },
        },
      }),
      dispatch: (action: { payload: { gameId: string; version: string } }) => {
        versions = { ...versions, [action.payload.gameId]: action.payload.version };
      },
    },
  } as unknown as types.IExtensionApi;
  return { api, emit };
}

describe("testGameVersions", () => {
  beforeEach(() => {
    vi.mocked(getGameVersion).mockResolvedValue("1.1");
    vi.mocked(updateInvalidatesMods).mockReturnValue("some");
  });

  it("emits game-version-changed when the version differs from the stored one", async () => {
    const { api, emit } = makeApi("1.0");

    const res = await testGameVersions(api);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("game-version-changed", GAME_ID, "1.0", "1.1");
    expect(res?.description.short).toBe("Game updated");
  });

  it("does not emit when the version is unchanged", async () => {
    const { api, emit } = makeApi("1.1");

    await testGameVersions(api);

    expect(emit).not.toHaveBeenCalled();
  });

  it("does not emit on the first check, when no version was stored yet", async () => {
    const { api, emit } = makeApi(undefined);

    await testGameVersions(api);

    expect(emit).not.toHaveBeenCalled();
  });

  it("does not emit when the current version can't be determined", async () => {
    vi.mocked(getGameVersion).mockResolvedValue(undefined);
    const { api, emit } = makeApi("1.0");

    await testGameVersions(api);

    expect(emit).not.toHaveBeenCalled();
  });

  it("emits even when incompatible mods suppress the update notification", async () => {
    const { api, emit } = makeApi("1.0", {
      oldMod: { attributes: { maxGameVersion: "1.0" } },
    });

    const res = await testGameVersions(api);

    expect(res?.description.short).toBe("Incompatible mods");
    expect(emit).toHaveBeenCalledWith("game-version-changed", GAME_ID, "1.0", "1.1");
  });

  it("emits even for games whose updates never invalidate mods", async () => {
    vi.mocked(updateInvalidatesMods).mockReturnValue("never");
    const { api, emit } = makeApi("1.0");

    const res = await testGameVersions(api);

    expect(res).toBeUndefined();
    expect(emit).toHaveBeenCalledWith("game-version-changed", GAME_ID, "1.0", "1.1");
  });

  it("emits once when two checks overlap", async () => {
    const { api, emit } = makeApi("1.0");

    await Promise.all([testGameVersions(api), testGameVersions(api)]);

    expect(emit).toHaveBeenCalledTimes(1);
  });
});

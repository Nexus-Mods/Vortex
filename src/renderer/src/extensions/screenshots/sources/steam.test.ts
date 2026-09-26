import type { Stats } from "fs";
import path from "path";

import { expect, it, describe, vi, beforeEach } from "vitest";

import type { ITString } from "@/util/i18n";

import type { GameMediaItem } from "../util/mediaTypes";
import { expectTString } from "../util/testHelpers";
import {
  screenshotsFolderBySteamID,
  clipsFolderBySteamID,
  accountIdToSteam64,
  steam64ToAccountId,
} from "./steam";

const { mockedFs } = vi.hoisted(() => {
  return {
    mockedFs: {
      stat: vi.fn<(p: string) => Promise<Stats>>(),
      access: vi.fn(),
      readdir: vi.fn<(dir: string) => Promise<string[]>>(),
      readFile: vi.fn<(file: string) => Promise<string>>(),
    },
  };
});

vi.mock("fs/promises", () => ({
  default: mockedFs,
}));

vi.mock("../../../util/Steam", () => ({
  default: {
    getGameStorePath: vi.fn().mockResolvedValue("/steam"),
    allGames: vi.fn().mockResolvedValue([]),
  },
}));

const fakeSteamScreenshotsVDF = `
"screenshots"
{
	"123"
	{
		"0"
		{
			"type"		"1"
			"filename"		"1716740/screenshots/20240818184553_1.jpg"
			"thumbnail"		"1716740/screenshots/thumbnails/20240818184553_1.jpg"
			"imported"		"1"
			"width"		"2560"
			"height"		"1440"
			"gameid"		"1716740"
			"creation"		"1724003153"
			"Permissions"		"2"
			"hscreenshot"		"18446744073709551615"
		}
	}
	"shortcutnames"
	{
	}
}

`;

describe("accountIdToSteam64/steam64ToAccountId", () => {
  it("converts account ID to Steam64", () => {
    const accountId = "38491042";
    const steam64 = accountIdToSteam64(accountId);
    expect(steam64).toEqual("76561197998756770");
  });

  it("converts Steam 64 to account ID", () => {
    const steam64 = "76561197998756770";
    const accountId = steam64ToAccountId(steam64);
    expect(accountId).toEqual("38491042");
  });
});

describe("screenshotsFolderBySteamID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds a source only when the VDF contains the given game", async () => {
    mockedFs.access.mockResolvedValue(undefined);
    mockedFs.readFile.mockResolvedValue(fakeSteamScreenshotsVDF);

    const userDataFolder = "";
    const steamGameId = "123";
    const userId = "456";
    const result = await screenshotsFolderBySteamID(userDataFolder, steamGameId, userId);

    expect(Object.keys(result).length).toEqual(1);
    expect(result["steam-screenshots-456"]).toBeDefined();
    expectTString(result["steam-screenshots-456"].name, "sources::steam::screenshots");
  });

  it("uses the Steam username if present", async () => {
    mockedFs.access.mockResolvedValue(undefined);
    mockedFs.readFile.mockResolvedValue(fakeSteamScreenshotsVDF);

    const result = await screenshotsFolderBySteamID("", "123", "456", "AUser");
    expectTString(result["steam-screenshots-456"].description, "sources::steam::screenshots_desc", {
      user: "AUser",
    });
  });

  it("falls back to the Steam user id when no username is known", async () => {
    mockedFs.access.mockResolvedValue(undefined);
    mockedFs.readFile.mockResolvedValue(fakeSteamScreenshotsVDF);

    const result = await screenshotsFolderBySteamID("", "123", "456");
    expect((result["steam-screenshots-456"].description as ITString).options).toMatchObject({
      user: "456",
    });
  });
});

describe("clipsFolderBySteamID", () => {
  it("adds a source only when matching clips folder exists", async () => {
    mockedFs.access.mockResolvedValue(undefined);
    mockedFs.readdir.mockResolvedValue(["clip_123"]);

    const userDataFolder = "";
    const steamGameId = "123";
    const userId = "456";
    const resultA = await clipsFolderBySteamID(userDataFolder, steamGameId, userId);
    const resultB = await clipsFolderBySteamID(userDataFolder, "000", userId);

    expect(Object.keys(resultA).length).toEqual(1);
    expect(resultA["steam-videos-456"]).toBeDefined();
    expect(Object.keys(resultB).length).toEqual(0);
    expect(resultB["steam-videos-456"]).not.toBeDefined();
  });
});

describe("clipsFolderBySteamID -> discoverSteamClips", () => {
  it("maps Steam clips into the expected GameMediaItem", async () => {
    const clipsDir = path.join("userData", "456", "gamerecordings", "clips");
    const clipDir = path.join(clipsDir, "clip_123");
    const videoDir = path.join(clipDir, "video");
    mockedFs.access.mockResolvedValue(undefined);
    mockedFs.stat.mockResolvedValue({
      birthtime: new Date("2011-08-01"),
      mtime: new Date("2011-08-01"),
    } as unknown as Stats);
    mockedFs.readdir.mockImplementation(async (p: string) => {
      if (p === clipsDir) return Promise.resolve(["clip_123"]);
      if (p === videoDir) return Promise.resolve(["video_1"]);
      else throw new Error(`Unexpected path ${p}`);
    });
    const sources = await clipsFolderBySteamID("userData", "123", "456");
    expect(sources["steam-videos-456"]).toBeDefined();
    const clipsSource = sources["steam-videos-456"];

    const result = await clipsSource.discoverFn?.(clipsSource.path);

    expect(result.length).toEqual(1);
    const videoResult = result[0];
    expect(videoResult).toEqual({
      id: "steam-videos-456::clip_123",
      name: "clip_123",
      path: path.join(videoDir, "video_1", "session.mpd"),
      sourceId: "steam-videos-456",
      type: "video",
      thumbnailPath: path.join(clipDir, "thumbnail.jpg"),
      createdAt: new Date("2011-08-01"),
      modifiedAt: new Date("2011-08-01"),
    } satisfies GameMediaItem);
  });
});

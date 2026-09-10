import fs from "fs/promises";

import { expect, it, describe, vi, beforeEach } from "vitest";

import type { GameMediaItem } from "../util/mediaTypes";
import {
  screenshotsFolderBySteamID,
  clipsFolderBySteamID,
  accountIdToSteam64,
  steam64ToAccountId,
} from "./steam";

vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    access: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
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
  const mockedFs = vi.mocked(fs);

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
  });

  it("uses the Steam username if present", async () => {
    mockedFs.access.mockResolvedValue(undefined);
    mockedFs.readFile.mockResolvedValue(fakeSteamScreenshotsVDF);

    const userDataFolder = "";
    const steamGameId = "123";
    const userId = "456";
    const userName = "AUser";
    const result = await screenshotsFolderBySteamID(userDataFolder, steamGameId, userId, userName);

    expect(result["steam-screenshots-456"].description.endsWith(userName)).toBeTruthy();
  });
});

describe("clipsFolderBySteamID", () => {
  const mockedFs = vi.mocked(fs);

  it("adds a source only when matching clips folder exists", async () => {
    mockedFs.access.mockResolvedValue(undefined);
    mockedFs.readdir.mockResolvedValue(["clip_123"] as any);

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
  const mockedFs = vi.mocked(fs);

  it("maps Steam clips into the expected GameMediaItem", async () => {
    mockedFs.access.mockResolvedValue(undefined);
    mockedFs.stat.mockResolvedValue({
      birthtime: new Date("2011-08-01"),
      mtime: new Date("2011-08-01"),
    } as any);
    mockedFs.readdir.mockImplementation(async (p: string) => {
      if (p === "userData\\456\\gamerecordings\\clips") return ["clip_123"] as any;
      if (p === "userData\\456\\gamerecordings\\clips\\clip_123\\video") return ["video_1"] as any;
      else throw new Error(`Unexpected path ${p}`);
    });
    const sources = await clipsFolderBySteamID("userData", "123", "456");
    expect(sources["steam-videos-456"]).toBeDefined();
    const clipsSource = sources["steam-videos-456"];

    const result = await clipsSource.discoverFn?.(clipsSource.path);

    expect(result.length).toEqual(1);
    const videoResult = result[0];
    expect(videoResult).toEqual({
      id: "steam-videos-456-clip_123",
      name: "clip_123",
      path: "userData\\456\\gamerecordings\\clips\\clip_123\\video\\video_1\\session.mpd",
      sourceId: "steam-videos-456",
      type: "video",
      thumbnailPath: "userData\\456\\gamerecordings\\clips\\clip_123\\thumbnail.jpg",
      createdAt: new Date("2011-08-01"),
      modifiedAt: new Date("2011-08-01"),
    } satisfies GameMediaItem);
  });
});

import { GameDomain } from "@vortex/shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The action layer is tested against mocked boundaries: the store selectors, the
// enable/disable action and the download events. What matters here is which mods end up
// enabled and disabled, so `setModsEnabled` is the assertion surface.
vi.mock("@/extensions/nexus_integration/selectors", () => ({ shouldShowPremiumAd: vi.fn() }));
vi.mock("@/extensions/nexus_integration/util", () => ({ numericGameIdToDomainName: vi.fn() }));
vi.mock("@/extensions/nexus_integration/util/convertGameId", () => ({
  convertGameIdReverse: vi.fn(() => "skyrimse"),
}));
vi.mock("@/extensions/gamemode_management/selectors", () => ({ knownGames: vi.fn(() => []) }));
vi.mock("@/extensions/profile_management/selectors", () => ({ activeProfile: vi.fn() }));
vi.mock("@/extensions/profile_management/actions/profiles", () => ({
  setModsEnabled: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/logging", () => ({ log: vi.fn() }));
vi.mock("@/extensions/mod_management/util/modName", () => ({ default: vi.fn(() => "Mod") }));
vi.mock("@/util/util", () => ({ sanitizeCSSId: vi.fn((id: string) => id) }));
vi.mock("../shared/installTracking", () => ({
  trackedInstall: vi.fn((_api, _identity, run: () => Promise<void>) => run()),
}));

import { knownGames } from "@/extensions/gamemode_management/selectors";
import { shouldShowPremiumAd } from "@/extensions/nexus_integration/selectors";
import { numericGameIdToDomainName } from "@/extensions/nexus_integration/util";
import { setModsEnabled } from "@/extensions/profile_management/actions/profiles";
import { activeProfile } from "@/extensions/profile_management/selectors";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { trackedInstall } from "../shared/installTracking";
import {
  downloadFileRequirement,
  installDownloadedFile,
  openFilePage,
  openModPage,
} from "./fileRequirementActions";
import type { IDownloadedFile, IInstalledFile } from "./installedFiles";
import type { IFileRequirementCandidate } from "./mapRequirementsReport";

const mockPremiumAd = vi.mocked(shouldShowPremiumAd);
const mockActiveProfile = vi.mocked(activeProfile);
const mockSetModsEnabled = vi.mocked(setModsEnabled);
const mockTrackedInstall = vi.mocked(trackedInstall);

const NEXUS_GAME_ID = 1704;

/** A composite UID as the Nexus API builds them: (gameId << 32) | id. */
const uid = (id: number): string => ((BigInt(NEXUS_GAME_ID) << BigInt(32)) | BigInt(id)).toString();

/** The mod id "start-install-download" reports for the freshly installed version. */
const INSTALLED_MOD_ID = "correct-version";

const CANDIDATE: IFileRequirementCandidate = {
  fileUID: uid(9001),
  modUID: uid(42),
  modName: "Required Mod",
  fileName: "required.zip",
  version: "2.0",
  adultContent: false,
};

const DOWNLOADED: IDownloadedFile = {
  downloadId: "dl-1",
  fileUID: uid(9001),
  modUID: uid(42),
  modName: "Required Mod",
  fileName: "required.zip",
  version: "2.0",
  adultContent: false,
};

function installedFile(modId: string): IInstalledFile {
  return {
    modId,
    fileUID: uid(9000),
    modUID: uid(42),
    modName: "Required Mod",
    fileName: "required-old.zip",
    version: "1.0",
    adultContent: false,
    enabled: true,
  };
}

/** An api whose mod store holds the given mod ids, and whose download events succeed. */
function makeApi(modIds: string[] = ["wrong-version", INSTALLED_MOD_ID]): IExtensionApi {
  const mods = Object.fromEntries(modIds.map((id) => [id, { id }]));
  return {
    getState: () => ({ persistent: { mods: { skyrimse: mods } } }),
    events: {
      emit: (event: string, ...args: unknown[]) => {
        // Both download events take a node-style callback; the id they report is all the
        // action uses. "start-download" carries extra options before its callback.
        const callback = args.find((arg) => typeof arg === "function") as (
          err: Error | null,
          res: string,
        ) => void;
        callback(null, event === "start-download" ? "dl-1" : INSTALLED_MOD_ID);
      },
    },
    showErrorNotification: vi.fn(),
  } as unknown as IExtensionApi;
}

/** The (modIds, enabled) pairs setModsEnabled was called with, in order. */
const enableCalls = (): Array<[string[], boolean]> =>
  mockSetModsEnabled.mock.calls.map((call) => [call[2], call[3]]);

const openUrl = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("api", { ...window.api, shell: { openUrl } });
  mockPremiumAd.mockReturnValue(false);
  mockSetModsEnabled.mockReturnValue(Promise.resolve() as never);
  mockTrackedInstall.mockImplementation((_api, _identity, run) => run());
  vi.mocked(numericGameIdToDomainName).mockImplementation((id) =>
    id === NEXUS_GAME_ID ? GameDomain("skyrimse") : undefined,
  );
  vi.mocked(knownGames).mockReturnValue([] as never);
  mockActiveProfile.mockReturnValue({ id: "profile-1", gameId: "skyrimse" } as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("downloadFileRequirement", () => {
  test("disables the version it replaces before enabling the download", async () => {
    const api = makeApi();

    expect(
      await downloadFileRequirement(api, CANDIDATE, undefined, installedFile("wrong-version")),
    ).toBe(true);

    // Disable first: leaving both enabled deploys two versions of the same mod.
    expect(enableCalls()).toEqual([
      [["wrong-version"], false],
      [[INSTALLED_MOD_ID], true],
    ]);
  });

  test("disables nothing when the download replaces no installed version", async () => {
    const api = makeApi();

    expect(await downloadFileRequirement(api, CANDIDATE)).toBe(true);

    expect(enableCalls()).toEqual([
      [[], false],
      [[INSTALLED_MOD_ID], true],
    ]);
  });

  test("disables nothing when the install reused the replaced version's mod entry", async () => {
    const api = makeApi();

    await downloadFileRequirement(api, CANDIDATE, undefined, installedFile(INSTALLED_MOD_ID));

    // Disabling it here would switch off the version just installed.
    expect(enableCalls()).toEqual([
      [[], false],
      [[INSTALLED_MOD_ID], true],
    ]);
  });

  test("disables nothing when the replaced version has left the mod store", async () => {
    const api = makeApi([INSTALLED_MOD_ID]);

    await downloadFileRequirement(api, CANDIDATE, undefined, installedFile("wrong-version"));

    expect(enableCalls()).toEqual([
      [[], false],
      [[INSTALLED_MOD_ID], true],
    ]);
  });

  test("routes free users to the file page instead of downloading", async () => {
    mockPremiumAd.mockReturnValue(true);

    expect(await downloadFileRequirement(makeApi(), CANDIDATE)).toBe(false);

    expect(openUrl).toHaveBeenCalledOnce();
    expect(mockTrackedInstall).not.toHaveBeenCalled();
    expect(mockSetModsEnabled).not.toHaveBeenCalled();
  });

  test("reports a failed install rather than throwing", async () => {
    const api = makeApi();
    mockTrackedInstall.mockRejectedValue(new Error("install failed"));

    expect(await downloadFileRequirement(api, CANDIDATE)).toBe(false);
    expect(api.showErrorNotification).toHaveBeenCalledOnce();
  });
});

describe("installDownloadedFile", () => {
  test("disables the version it replaces before enabling the install", async () => {
    const api = makeApi();

    expect(
      await installDownloadedFile(api, DOWNLOADED, undefined, installedFile("wrong-version")),
    ).toBe(true);

    expect(enableCalls()).toEqual([
      [["wrong-version"], false],
      [[INSTALLED_MOD_ID], true],
    ]);
  });

  test("installs a downloaded file for free users too", async () => {
    mockPremiumAd.mockReturnValue(true);

    expect(await installDownloadedFile(makeApi(), DOWNLOADED)).toBe(true);
  });
});

describe("Nexus pages", () => {
  beforeEach(() => {
    vi.mocked(numericGameIdToDomainName).mockImplementation((id) =>
      id === NEXUS_GAME_ID ? GameDomain("skyrimspecialedition") : undefined,
    );
  });

  test("opens the mod's page", () => {
    openModPage(makeApi(), CANDIDATE);

    expect(openUrl).toHaveBeenCalledWith("https://www.nexusmods.com/skyrimspecialedition/mods/42");
  });

  test("opens the file on its mod's Files tab", () => {
    openFilePage(makeApi(), CANDIDATE);

    expect(openUrl).toHaveBeenCalledWith(
      "https://www.nexusmods.com/skyrimspecialedition/mods/42?tab=files&file_id=9001&nmm=1",
    );
  });

  test("opens nothing when the game has no Nexus domain", () => {
    vi.mocked(numericGameIdToDomainName).mockReturnValue(undefined);

    openModPage(makeApi(), CANDIDATE);
    openFilePage(makeApi(), CANDIDATE);

    expect(openUrl).not.toHaveBeenCalled();
  });
});

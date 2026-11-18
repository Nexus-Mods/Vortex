import { VortexGameId } from "@vortex/shared";
import { describe, expect, it, vi } from "vitest";

import type { IState } from "../../../types/IState";
import { canCheckSteamFolder, steamEntryFor } from "./steamInput";

const BANNERLORD_PATH = "C:\\Steam\\steamapps\\common\\Mount & Blade II Bannerlord";
const INSTALL = { appId: 261550, buildId: 1, depots: [], sharedDepots: [] };

const steamEntries = [
  { appid: "261550", gamePath: BANNERLORD_PATH, installData: INSTALL },
  { appid: "489830", gamePath: "C:\\Steam\\steamapps\\common\\Skyrim Special Edition" },
];

vi.mock("../../gamemode_management/util/getGame", () => ({
  getGame: () => undefined,
  getGameStoresSafe: () => [{ id: "steam", snapshot: () => ({ entries: steamEntries }) }],
}));
vi.mock("../../nexus_integration/util", () => ({
  numericGameIdToDomainName: (id: number) =>
    ({ 3174: "mountandblade2bannerlord", 1704: "skyrimspecialedition" })[id],
}));

/** State with the given discovery entries and detected-games response. */
function stateWith(
  discovered: Record<string, { path?: string; store?: string }>,
  detected: Array<{ gameId: number; steam: string[] }> = [],
): IState {
  return {
    settings: { gameMode: { discovered } },
    session: {
      gameMode: {
        known: [],
        detectedGames: detected.map(({ gameId, steam }) => ({
          gameId,
          storeIDs: { steam, gog: [], epic: [] },
        })),
      },
    },
  } as unknown as IState;
}

const BANNERLORD = VortexGameId("mountandblade2bannerlord");

describe("steamEntryFor", () => {
  it("finds an undiscovered game through the detected-games response", () => {
    const state = stateWith({}, [{ gameId: 3174, steam: ["261550"] }]);
    expect(steamEntryFor(state, BANNERLORD)?.gamePath).toBe(BANNERLORD_PATH);
  });

  it("finds nothing for an undiscovered game the response didn't match", () => {
    expect(steamEntryFor(stateWith({}), BANNERLORD)).toBeUndefined();
  });

  it("matches a discovered game by its path", () => {
    const state = stateWith({
      mountandblade2bannerlord: { path: BANNERLORD_PATH, store: "steam" },
    });
    expect(steamEntryFor(state, BANNERLORD)?.appid).toBe("261550");
  });
});

describe("canCheckSteamFolder", () => {
  it("allows a game Vortex hasn't discovered yet", () => {
    const state = stateWith({}, [{ gameId: 3174, steam: ["261550"] }]);
    expect(canCheckSteamFolder(state, BANNERLORD)).toBe(true);
  });

  it("refuses a game Vortex manages from another store", () => {
    const state = stateWith(
      { mountandblade2bannerlord: { path: "D:\\GOG\\Bannerlord", store: "gog" } },
      [{ gameId: 3174, steam: ["261550"] }],
    );
    expect(canCheckSteamFolder(state, BANNERLORD)).toBe(false);
  });

  it("refuses a Steam entry without install data", () => {
    const state = stateWith({}, [{ gameId: 1704, steam: ["489830"] }]);
    expect(canCheckSteamFolder(state, VortexGameId("skyrimspecialedition"))).toBe(false);
  });
});

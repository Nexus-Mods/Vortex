import { GameDomain, VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IState } from "@/types/IState";

import { downloadKeys } from "./modInstallSelectors";

const GAME = VortexGameId("enderalspecialedition");
const DOMAIN = GameDomain("enderalspecialedition");
const SKYUI = 3863;

/** A finished download of SkyUI for Enderal SE. */
const download = (overrides: Partial<IDownload> = {}): IDownload =>
  ({
    state: "finished",
    game: [GAME],
    modInfo: { nexus: { ids: { gameId: DOMAIN, modId: SKYUI } } },
    ...overrides,
  }) as IDownload;

describe("downloadKeys", () => {
  /** The state the keys are read from: these downloads, and no known games. */
  const stateWith = (files: Record<string, IDownload>) =>
    ({
      persistent: { downloads: { files } },
      session: { gameMode: { known: [] } },
    }) as unknown as IState;

  it("keeps the same keys while only a download's progress changes", () => {
    const before = downloadKeys(stateWith({ dl: download({ received: 1 }) }));
    const after = downloadKeys(stateWith({ dl: download({ received: 2 }) }));

    expect(after).toBe(before);
  });

  it("gives a download without Nexus ids or a game no key, rather than failing", () => {
    const malformed = { state: "finished" } as IDownload;

    expect(downloadKeys(stateWith({ dl: download(), malformed }))).toEqual({
      dl: `${DOMAIN}/${SKYUI}`,
      malformed: undefined,
    });
  });
});

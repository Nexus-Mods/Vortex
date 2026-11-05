import { describe, expect, it } from "vitest";

import type { IState } from "@/types/IState";

import type { IDownload } from "../../types/IDownload";
import { downloadModFilePageUrl } from "./downloadModFilePageUrl";

const state = (
  known: { id: string; details?: { nexusPageId?: string; nxmLinkId?: string } }[] = [],
): IState => ({ session: { gameMode: { known } } }) as unknown as IState;

const download = (download: Partial<IDownload>): IDownload => download as IDownload;

describe("downloadModFilePageUrl", () => {
  it("is the file's page on its mod's Files tab, from the download's Nexus ids", () => {
    const dl = download({
      game: ["skyrimse"],
      modInfo: { nexus: { ids: { gameId: "skyrimspecialedition", modId: 12604, fileId: 42 } } },
    });

    expect(downloadModFilePageUrl(state(), dl)).toBe(
      "https://www.nexusmods.com/skyrimspecialedition/mods/12604?tab=files&file_id=42&nmm=1",
    );
  });

  it("opens the domain the Nexus ids' game links to, which need not be the domain", () => {
    const dl = download({
      game: ["skyrimse"],
      modInfo: { nexus: { ids: { gameId: "SkyrimSE", modId: 12604, fileId: 42 } } },
    });

    expect(
      downloadModFilePageUrl(
        state([
          {
            id: "skyrimse",
            details: { nxmLinkId: "SkyrimSE", nexusPageId: "skyrimspecialedition" },
          },
        ]),
        dl,
      ),
    ).toBe("https://www.nexusmods.com/skyrimspecialedition/mods/12604?tab=files&file_id=42&nmm=1");
  });

  it("falls back to the file's metadata, joining the download's game to its Nexus domain", () => {
    const dl = download({
      game: ["skyrimse"],
      modInfo: { meta: { details: { modId: "12604", fileId: "42" } } },
    });

    expect(
      downloadModFilePageUrl(
        state([{ id: "skyrimse", details: { nexusPageId: "skyrimspecialedition" } }]),
        dl,
      ),
    ).toBe("https://www.nexusmods.com/skyrimspecialedition/mods/12604?tab=files&file_id=42&nmm=1");
  });

  it("is undefined when the download has neither Nexus ids nor metadata", () => {
    expect(downloadModFilePageUrl(state(), download({ game: ["skyrimse"], modInfo: {} }))).toBe(
      undefined,
    );
  });

  it("is undefined when the download is unknown", () => {
    expect(downloadModFilePageUrl(state(), undefined)).toBe(undefined);
  });
});

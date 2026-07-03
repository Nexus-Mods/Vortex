import type { IGameInfo, IModCategory } from "@nexusmods/nexus-api";

import { log } from "@/logging";
import { getApplication } from "@/util/api";

const GameV1URL = (domainName: string) => `https://api.nexusmods.com/v1/games/${domainName}.json`;

export default async function getGameCategories(
  domainName: string,
  token: string,
): Promise<IModCategory[] | undefined> {
  // This could be outsourced to a library, but it's unclear how
  try {
    const url = GameV1URL(domainName);
    const headers = {
      Accept: "application/json",
      "Application-Name": "Vortex",
      "Application-Version": getApplication().version,
      Authorization: `Bearer ${token}`,
    };
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Server responded with HTTP ${res.status}`);
    const game: IGameInfo = (await res.json()) as IGameInfo;
    return game.categories;
  } catch (e: unknown) {
    log("warn", "Failed to get categories for game", e);
    if ((e as Error).message === "Failed to fetch")
      throw new Error("An unexpected network error occurred.", { cause: e });
    throw e;
  }
}

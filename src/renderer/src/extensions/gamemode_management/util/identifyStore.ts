import type { IGameStore } from "@/types/IGameStore";
import getNormalizeFunc from "@/util/getNormalizeFunc";

export async function identifyStore(
  gamePath: string,
  stores: IGameStore[],
): Promise<string | undefined> {
  const normalizePromise = getNormalizeFunc(gamePath);

  const fallback = async (gamePath: string, store: IGameStore): Promise<boolean> => {
    // TODO: Bluebird to native
    const normalize = await Promise.resolve(normalizePromise);
    try {
      const games = await store.allGames();
      return games.find((game) => normalize(game.gamePath) === normalize(gamePath)) !== undefined;
    } catch {
      return false;
    }
  };

  for (const store of stores) {
    const matches =
      (await store.identifyGame?.(gamePath, (gamePath) => fallback(gamePath, store))) ??
      (await fallback(gamePath, store));
    if (matches) return store.id;
  }

  return undefined;
}

import type PromiseBB from "bluebird";

import type { IGameStore } from "@/types/IGameStore";
import getNormalizeFunc from "@/util/getNormalizeFunc";

export async function identifyStore(
  gamePath: string,
  stores: IGameStore[],
): Promise<string | undefined> {
  const normalizePromise = getNormalizeFunc(gamePath);

  const fallback = (gamePath: string, store: IGameStore): PromiseBB<boolean> => {
    return normalizePromise.then((normalize) =>
      store
        .allGames()
        .then((games) => {
          return (
            games.find((game) => normalize(game.gamePath) === normalize(gamePath)) !== undefined
          );
        })
        .catch(() => false),
    );
  };

  for (const store of stores) {
    // TODO: Bluebird to native
    const bluebirdPromise =
      store.identifyGame?.(gamePath, (gamePath) => fallback(gamePath, store)) ??
      fallback(gamePath, store);
    const matches = await Promise.resolve(bluebirdPromise);
    if (matches) return store.id;
  }

  return undefined;
}

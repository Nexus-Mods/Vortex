import PromiseBB from "bluebird";

import type { IGameStore } from "@/types/IGameStore";
import getNormalizeFunc from "@/util/getNormalizeFunc";

export function identifyStore(
  gamePath: string,
  stores: IGameStore[],
): PromiseBB<string | undefined> {
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

  let result = PromiseBB.resolve<string | undefined>(undefined);
  for (const store of stores) {
    result = result.then((found) => {
      if (found !== undefined) {
        return found;
      }

      const probe =
        store.identifyGame?.(gamePath, (gamePath) => fallback(gamePath, store)) ??
        fallback(gamePath, store);
      return probe.then((matches) => (matches ? store.id : undefined));
    });
  }

  return result;
}

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

  return PromiseBB.reduce(
    stores,
    (found: string | undefined, store) =>
      found !== undefined
        ? PromiseBB.resolve(found)
        : (
            store.identifyGame?.(gamePath, (gamePath) => fallback(gamePath, store)) ??
            fallback(gamePath, store)
          ).then((matches) => (matches ? store.id : undefined)),
    undefined,
  );
}

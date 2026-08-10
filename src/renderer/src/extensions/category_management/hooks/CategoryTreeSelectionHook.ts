import { useCallback, useMemo } from "react";
import { useSelector, useStore } from "react-redux";

import { removeCategory, renameCategory, setCategory, setCategoryOrder } from "@/actions";
import type { IMod, IState } from "@/types/api";
import { getGame, nexusGameId } from "@/util/api";
import { activeGameId } from "@/util/selectors";

import type { ICategory } from "../types/ICategoryDictionary";

type IStateWithCreds = IState & {
  confidential: {
    account: { nexus?: { OAuthCredentials?: { token: string; refreshToken: string } } };
  };
};

export default function useCategoryTreeSelection() {
  const { categories, mods, gameId, domainName, OAuthCredentials } = useSelector(
    (state: IStateWithCreds) => {
      const gameId = activeGameId(state);
      const game = getGame(gameId);
      const domainName = nexusGameId(game);
      return {
        OAuthCredentials: state.confidential.account.nexus?.OAuthCredentials,
        gameId,
        domainName,
        mods: state.persistent.mods[gameId],
        categories: state.persistent.categories?.[gameId] || {},
      };
    },
  );

  const modsByCategory = useMemo(() => {
    return Object.keys(mods || {}).reduce(
      (prev: { [categoryId: string]: IMod[] }, current: string) => {
        const mod = mods[current];
        const category = mod?.attributes?.category;
        if (category === undefined) {
          return prev;
        }
        if (!prev[category]) prev[category] = [mod];
        else prev[category].push(mod);
        return prev;
      },
      {},
    );
  }, [mods]);

  const store = useStore();

  const onRenameCategory = useCallback(
    (categoryId: string, newCategory: string) =>
      store.dispatch(renameCategory(gameId, categoryId, newCategory)),
    [store, gameId],
  );

  const onSetCategory = useCallback(
    (gameId: string, categoryId: string, category: ICategory) =>
      store.dispatch(setCategory(gameId, categoryId, category)),
    [store],
  );

  const onRemoveCategory = useCallback(
    (categoryId: string) => {
      store.dispatch(removeCategory(gameId, categoryId));
    },
    [store, gameId],
  );

  const onSetCategoryOrder = useCallback(
    (gameId: string, categoryIds: string[]) =>
      store.dispatch(setCategoryOrder(gameId, categoryIds)),
    [store],
  );

  return {
    categories,
    mods,
    modsByCategory,
    gameId,
    domainName,
    OAuthCredentials,
    onSetCategoryOrder,
    onRemoveCategory,
    onRenameCategory,
    onSetCategory,
  };
}

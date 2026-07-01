import { randomUUID } from "crypto";

import { useCallback, useMemo } from "react";
import { useSelector, useStore } from "react-redux";
import type { AnyAction } from "redux";

import {
  removeCategory,
  renameCategory,
  setCategory,
  setCategoryOrder,
  showDialog,
} from "@/actions";
import type {
  DialogActions,
  DialogType,
  IDialogContent,
  IErrorOptions,
  IMod,
  IState,
} from "@/types/api";
import { getGame, nexusGameId } from "@/util/api";
import { showError } from "@/util/message";
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
      console.log("Dispatching remove", gameId, categoryId);
      store.dispatch(removeCategory(gameId, categoryId));
    },
    [store, gameId],
  );

  const onSetCategoryOrder = useCallback(
    (gameId: string, categoryIds: string[]) =>
      store.dispatch(setCategoryOrder(gameId, categoryIds)),
    [store],
  );

  const onShowError = useCallback(
    (message: string, details: string | Error, options: IErrorOptions) =>
      showError(store.dispatch, message, details, options),
    [store],
  );

  const onShowDialog = useCallback(
    (type: DialogType, title: string, content: IDialogContent, actions: DialogActions) =>
      store.dispatch(showDialog(type, title, content, actions) as unknown as AnyAction),
    [store],
  );

  const onCreateCategory = useCallback(
    (name: string, order: number = 0, parentCategory?: string) => {
      const uid = randomUUID();
      onSetCategory(gameId, uid, { name, parentCategory, order });
    },
    [gameId, onSetCategory],
  );

  return {
    categories,
    mods,
    modsByCategory,
    gameId,
    domainName,
    OAuthCredentials,
    onShowDialog,
    onShowError,
    onSetCategoryOrder,
    onCreateCategory,
    onRemoveCategory,
    onRenameCategory,
    onSetCategory,
  };
}

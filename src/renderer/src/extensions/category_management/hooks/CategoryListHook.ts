import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector, useStore } from "react-redux";
import type { AnyAction } from "redux";

import {
  removeCategory,
  renameCategory,
  setCategory,
  setCategoryOrder,
  showDialog,
} from "@/actions";
import type { DialogActions, DialogType, IDialogContent, IErrorOptions, IState } from "@/types/api";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { showError } from "@/util/message";
import { activeGameId } from "@/util/selectors";

import type { ICategory } from "../types/ICategoryDictionary";

export default function useCategoryList() {
  const { gameMode, language, categories, mods } = useSelector((state: IState) => {
    const gameMode = activeGameId(state);
    return {
      gameMode,
      language: state.settings.interface.language,
      categories: state.persistent.categories?.[gameMode] || {},
      mods: state.persistent.mods[gameMode],
    };
  });

  const { t } = useTranslation("common");

  const store = useStore();

  const onRenameCategory = useCallback(
    (gameId: string, categoryId: string, newCategory: string) =>
      store.dispatch(renameCategory(gameId, categoryId, newCategory)),
    [store],
  );

  const onSetCategory = useCallback(
    (gameId: string, categoryId: string, category: ICategory) =>
      store.dispatch(setCategory(gameId, categoryId, category)),
    [store],
  );

  const onRemoveCategory = useCallback(
    (gameId: string, categoryId: string) => store.dispatch(removeCategory(gameId, categoryId)),
    [store],
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

  return {
    t,
    gameMode,
    language,
    categories,
    mods,
    onRenameCategory,
    onSetCategory,
    onRemoveCategory,
    onSetCategoryOrder,
    onShowError,
    onShowDialog,
  };
}

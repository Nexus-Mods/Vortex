import { useTranslation } from "react-i18next";

import useCategoryToolbarActions from "./CategoryToolbarActionsHook";
import useCategoryTreeActions from "./CategoryTreeActionsHook";
import useCategoryTreeData from "./CategoryTreeDataHook";
import useCategoryTreeSelection from "./CategoryTreeSelectionHook";
import useCategoryTreeState from "./CategoryTreeStateHook";

export default function useCategoryTree() {
  const { t } = useTranslation("common");
  const state = useCategoryTreeState();
  const selection = useCategoryTreeSelection();

  const tree = useCategoryTreeData({
    categories: selection.categories,
    modsbyCategory: selection.modsByCategory,
    expanded: state.expanded,
    setExpanded: state.setExpanded,
    showEmpty: state.showEmpty,
    searchString: state.searchString,
  });

  const actions = useCategoryTreeActions({
    t,
    categories: selection.categories,
    modsByCategory: selection.modsByCategory,
    gameId: selection.gameId,
    domainName: selection.domainName,
    onRemoveCategory: selection.onRemoveCategory,
    onSetCategory: selection.onSetCategory,
    onSetCategoryOrder: selection.onSetCategoryOrder,
    OAuthCredentials: selection.OAuthCredentials,
    isFetching: state.isFetching,
    isFetchError: state.isFetchError,
    setIsFetchError: state.setIsFetchError,
    setIsFetching: state.setIsFetching,
    setFetchError: state.setFetchError,
  });

  const toolbarActions = useCategoryToolbarActions({
    t,
    expanded: state.expanded,
    showEmpty: state.showEmpty,
    treeData: tree.treeData,
    setAddParentVisible: state.startCreateParentCategory,
    ...state,
    ...actions,
  });

  return {
    t,
    ...state,
    ...tree,
    ...actions,
    toolbarActions,
    onRenameCategory: selection.onRenameCategory,
  };
}

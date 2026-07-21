import { useCallback, useState } from "react";

export default function useCategoryTreeState() {
  const [addParentVisible, setAddParentVisible] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set<string>());
  const [showEmpty, setShowEmpty] = useState(true);
  const [searchString, setSearchString] = useState<string>("");
  const [newParentCategoryName, setNewParentCategoryName] = useState("");

  // Fetch error state values
  const [fetchError, setFetchError] = useState<{ title: string; detail: string } | undefined>();
  const [isFetching, setIsFetching] = useState(false);
  const [isFetchError, setIsFetchError] = useState(false);

  const toggleExpand = useCallback((categoryId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      console.log("Updating expanded categories", { prev, next, categoryId });
      return next;
    });
  }, []);

  const toggleEmpty = useCallback(() => {
    setShowEmpty((prev) => !prev);
  }, []);

  const startCreateParentCategory = (show: boolean = true) => {
    if (!show) setNewParentCategoryName("");
    setAddParentVisible(show);
  };

  const expandAll = useCallback((ids: string[]) => {
    setExpanded(new Set<string>(ids));
  }, []);

  const collapseAll = useCallback(() => {
    setExpanded(new Set<string>());
  }, []);

  const clearFetchError = () => {
    setIsFetchError(false);
    setFetchError(undefined);
  };

  return {
    addParentVisible,
    expanded,
    showEmpty,
    searchString,
    newParentCategoryName,
    setSearchString,
    setNewParentCategoryName,
    toggleExpand,
    toggleEmpty,
    startCreateParentCategory,
    expandAll,
    collapseAll,
    setExpanded,
    fetchError,
    isFetchError,
    isFetching,
    setFetchError,
    setIsFetching,
    setIsFetchError,
    clearFetchError,
  };
}

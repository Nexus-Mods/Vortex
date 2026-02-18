import React, { useCallback, useEffect, useReducer } from "react";
import { useSelector } from "react-redux";

import type { IMainPage } from "../types/IMainPage";

import {
  mainPage as mainPageSelector,
  secondaryPage as secondaryPageSelector,
} from "../util/selectors";
import { MainPageContainer } from "../views/MainPageContainer";

export const usePageRendering = () => {
  const mainPage = useSelector(mainPageSelector);
  const secondaryPage = useSelector(secondaryPageSelector);

  const [loadedPages, setLoadedPages] = useReducer(
    (prev: string[], pageId: string) =>
      prev.includes(pageId) ? prev : [...prev, pageId],
    mainPage ? [mainPage] : [],
  );

  // Track mainPage changes and add to loadedPages if needed
  useEffect(() => {
    if (mainPage) {
      setLoadedPages(mainPage);
    }
  }, [mainPage]);

  const renderPage = useCallback(
    (page: IMainPage) => {
      if (loadedPages.indexOf(page.id) === -1) {
        return null;
      }

      const active = [mainPage, secondaryPage].indexOf(page.id) !== -1;

      return (
        <MainPageContainer
          active={active}
          key={page.id}
          page={page}
          secondary={secondaryPage === page.id}
        />
      );
    },
    [loadedPages, mainPage, secondaryPage],
  );

  return {
    mainPage,
    secondaryPage,
    loadedPages,
    setLoadedPages,
    renderPage,
  };
};

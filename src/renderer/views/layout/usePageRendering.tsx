import React from "react";
import { useSelector } from "react-redux";

import type { IMainPage } from "../../../types/IMainPage";
import type { IState } from "../../../types/IState";

import { MainPageContainer } from "../MainPageContainer";
import { Settings } from "../Settings";

export const settingsPage: IMainPage = {
  id: "application_settings",
  title: "Settings",
  group: "global",
  component: Settings,
  icon: "settings",
  propsFunc: () => undefined,
  visible: () => true,
};

export const usePageRendering = () => {
  const mainPage = useSelector((state: IState) => state.session.base.mainPage);
  const secondaryPage = useSelector(
    (state: IState) => state.session.base.secondaryPage,
  );

  const [loadedPages, setLoadedPages] = React.useReducer(
    (prev: string[], pageId: string) =>
      prev.includes(pageId) ? prev : [...prev, pageId],
    mainPage ? [mainPage] : [],
  );

  // Track mainPage changes and add to loadedPages if needed
  React.useEffect(() => {
    if (mainPage) {
      setLoadedPages(mainPage);
    }
  }, [mainPage]);

  const renderPage = React.useCallback(
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

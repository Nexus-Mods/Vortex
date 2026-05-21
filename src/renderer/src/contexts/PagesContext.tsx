import React, {
  type FC,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useDispatch, useSelector } from "react-redux";

import { setOpenMainPage } from "../actions/session";
import { useMainPages } from "../hooks/useMainPages";
import type { IMainPage } from "../types/IMainPage";
import type { IState } from "../types/IState";
import {
  activeGameId as activeGameIdSelector,
  activeProfileId as activeProfileIdSelector,
  mainPage as mainPageSelector,
} from "../util/selectors";
import { builtInPages } from "./builtInPages";

export interface IPagesContext {
  mainPages: IMainPage[];
  mainPage: string;
}

const defaultValue: IPagesContext = {
  mainPages: [],
  mainPage: "",
};

const PagesContext = createContext<IPagesContext>(defaultValue);

export interface IPagesProviderProps {
  children: ReactNode;
}

const isPageVisible = (page: IMainPage): boolean => {
  try {
    return page.visible();
  } catch {
    return false;
  }
};

export const PagesProvider: FC<IPagesProviderProps> = ({ children }) => {
  const dispatch = useDispatch();
  const mainPages = useMainPages();
  const mainPage = useSelector(mainPageSelector);
  const activeProfileId = useSelector(activeProfileIdSelector);
  const activeGameId = useSelector(activeGameIdSelector);
  const useModernLayout = useSelector((state: IState) => state.settings.window.useModernLayout);
  const profilesVisible = useSelector((state: IState) => state.settings.interface.profilesVisible);

  const sortedPages = useMemo(
    () =>
      [...mainPages, ...builtInPages]
        .filter((page) => {
          if (useModernLayout && page.isClassicOnly) return false;
          if (!useModernLayout && page.isModernOnly) return false;
          return true;
        })
        .sort((a, b) => {
          const priorityDiff = (a.priority ?? 100) - (b.priority ?? 100);
          if (priorityDiff !== 0) {
            return priorityDiff;
          }
          return a.title.localeCompare(b.title, undefined, { numeric: true });
        }),
    [mainPages, useModernLayout],
  );

  // Redirect to first visible page when current page becomes invisible
  useEffect(() => {
    const page = sortedPages.find((iter) => iter.id === mainPage);
    if (page !== undefined && !isPageVisible(page)) {
      // When no game/profile is active, redirect to the dashboard rather than
      // the first visible page (which could be the Games page)
      if (activeProfileId === undefined && activeGameId === undefined) {
        const dashboard = sortedPages.find(
          (iter) => iter.group === "dashboard" && isPageVisible(iter),
        );
        if (dashboard !== undefined) {
          dispatch(setOpenMainPage(dashboard.id, false));
          return;
        }
      }
      const firstVisible = sortedPages.find((iter) => isPageVisible(iter));
      if (firstVisible !== undefined) {
        dispatch(setOpenMainPage(firstVisible.id, false));
      }
    }
  }, [mainPage, sortedPages, activeProfileId, activeGameId, profilesVisible, dispatch]);

  const contextValue = useMemo(
    () => ({
      mainPages: sortedPages,
      mainPage,
    }),
    [sortedPages, mainPage],
  );

  return <PagesContext.Provider value={contextValue}>{children}</PagesContext.Provider>;
};

export const PagesConsumer = PagesContext.Consumer;

export const usePagesContext = (): IPagesContext => {
  return useContext(PagesContext);
};

import React, {
  type FC,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IMainPage } from "../../types/IMainPage";
import type { IState } from "../../types/IState";

import { setOpenMainPage } from "../../actions/session";
import { useMainPages } from "../hooks/useMainPages";
import { GameSettings } from "../views/GameSettings";
import { Settings } from "../views/Settings";

const gameSettingsPage: IMainPage = {
  priority: 200,
  id: "game_settings",
  title: "Settings",
  group: "per-game",
  isModernOnly: true,
  component: GameSettings,
  icon: "settings",
  propsFunc: () => undefined,
  visible: () => true,
};

const settingsPage: IMainPage = {
  priority: 30,
  id: "application_settings",
  title: "Settings",
  group: "global",
  component: Settings,
  icon: "settings",
  propsFunc: () => undefined,
  visible: () => true,
};

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

export const PagesProvider: FC<IPagesProviderProps> = ({ children }) => {
  const dispatch = useDispatch();
  const mainPages = useMainPages();
  const mainPage = useSelector((state: IState) => state.session.base.mainPage);
  const useModernLayout = useSelector(
    (state: IState) => state.settings.window.useModernLayout,
  );

  const sortedPages = useMemo(
    () =>
      [...mainPages, settingsPage, gameSettingsPage]
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

  // Redirect to Dashboard when current page becomes invisible
  useEffect(() => {
    const page = sortedPages.find((iter) => iter.id === mainPage);
    if (page !== undefined && !page.visible()) {
      dispatch(setOpenMainPage("Dashboard", false));
    }
  }, [mainPage, sortedPages, dispatch]);

  const contextValue = useMemo(
    () => ({
      mainPages: sortedPages,
      mainPage,
    }),
    [sortedPages, mainPage],
  );

  return (
    <PagesContext.Provider value={contextValue}>
      {children}
    </PagesContext.Provider>
  );
};

export const PagesConsumer = PagesContext.Consumer;

export const usePagesContext = (): IPagesContext => {
  return useContext(PagesContext);
};

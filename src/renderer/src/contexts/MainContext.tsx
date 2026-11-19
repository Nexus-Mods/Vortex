import React, { type ReactNode, type FC, useContext, useEffect, useMemo, useReducer } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setOpenMainPage } from "../actions/session";
import { useExtensionContext } from "../ExtensionProvider";
import type { IComponentContext } from "../types/IComponentContext";
import type { IState } from "../types/IState";
import {
  ComponentExProvider,
  MainContext,
  setMainContextFallback,
} from "./main_context/MainContext";
import { useMenuLayerContext } from "./MenuLayerContext";
import { useWindowContext } from "./WindowContext";

export { MainContext };

// In modern layout, some pages move to a different location (e.g. Mods settings
// moves from global settings to the per-game preferences page)
const PAGE_REDIRECTS_MODERN: Record<string, string> = {
  application_settings: "game_settings",
};

export interface IMainProviderProps {
  children: ReactNode;
}

export const MainProvider: FC<React.PropsWithChildren<IMainProviderProps>> = ({ children }) => {
  const extensions = useExtensionContext();
  const api = extensions.getApi();

  const dispatch = useDispatch();
  const { menuLayerElement } = useMenuLayerContext();
  const { getModifiers } = useWindowContext();
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const useModernLayout = useSelector((state: IState) => state.settings.window.useModernLayout);

  // Set up event listeners for api events
  useEffect(() => {
    const showMainPageHandler = (pageId: string) => {
      const resolvedId = useModernLayout ? (PAGE_REDIRECTS_MODERN[pageId] ?? pageId) : pageId;
      dispatch(setOpenMainPage(resolvedId, false));
    };

    const refreshMainPageHandler = () => {
      forceUpdate();
    };

    api.events.on("show-main-page", showMainPageHandler);
    api.events.on("refresh-main-page", refreshMainPageHandler);

    return () => {
      api.events.removeListener("show-main-page", showMainPageHandler);
      api.events.removeListener("refresh-main-page", refreshMainPageHandler);
    };
  }, [api, dispatch, useModernLayout]);

  const contextValue = useMemo(() => {
    const value = { api, menuLayer: menuLayerElement, getModifiers };
    // Set during render rather than in an effect: effects run children first, and a child can
    // render a separate root (react-bootstrap's OverlayTrigger) before this one's effect runs.
    setMainContextFallback(value);
    return value;
  }, [api, menuLayerElement, getModifiers]);

  return (
    <MainContext.Provider value={contextValue}>
      <ComponentExProvider>{children}</ComponentExProvider>
    </MainContext.Provider>
  );
};

export const MainConsumer = MainContext.Consumer;

export const useMainContext = (): IComponentContext => {
  return useContext(MainContext);
};

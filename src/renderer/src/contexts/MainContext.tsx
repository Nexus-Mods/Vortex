import PropTypes from "prop-types";
import React, {
  Component,
  createContext,
  type ReactNode,
  type FC,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ValidationMap,
} from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "../types/IState";

import type { IComponentContext } from "../types/IComponentContext";

import { setOpenMainPage } from "../actions/session";
import { useExtensionContext } from "../ExtensionProvider";
import { useMenuLayerContext } from "./MenuLayerContext";
import { useWindowContext } from "./WindowContext";

// In modern layout, some pages move to a different location (e.g. Mods settings
// moves from global settings to the per-game preferences page)
const PAGE_REDIRECTS_MODERN: Record<string, string> = {
  application_settings: "game_settings",
};

const defaultValue: IComponentContext = {
  api: undefined,
  menuLayer: undefined,
  getModifiers: () => ({ alt: false, ctrl: false, shift: false }),
};

export const MainContext = createContext<IComponentContext>(defaultValue);

export interface IMainProviderProps {
  children: ReactNode;
}

export const MainProvider: FC<IMainProviderProps> = ({ children }) => {
  const extensions = useExtensionContext();
  const api = extensions.getApi();

  const dispatch = useDispatch();
  const { menuLayerElement } = useMenuLayerContext();
  const { getModifiers } = useWindowContext();
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const useModernLayout = useSelector(
    (state: IState) => state.settings.window.useModernLayout,
  );

  // Set up event listeners for api events
  useEffect(() => {
    const showMainPageHandler = (pageId: string) => {
      const resolvedId = useModernLayout
        ? (PAGE_REDIRECTS_MODERN[pageId] ?? pageId)
        : pageId;
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

  const contextValue = useMemo(
    () => ({
      api,
      menuLayer: menuLayerElement,
      getModifiers,
    }),
    [api, menuLayerElement, getModifiers],
  );

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

interface IComponentExProviderProps {
  children: ReactNode;
}

// This class component provides the legacy React context API (childContextTypes/getChildContext)
// required by child components using ComponentEx with contextTypes. Cannot be replaced with a
// functional component as the legacy context API is only available in class components.
// eslint-disable-next-line @eslint-react/no-class-component
class ComponentExProvider extends Component<IComponentExProviderProps> {
  public static contextType = MainContext;
  declare public context: IComponentContext;

  public static childContextTypes: ValidationMap<unknown> = {
    api: PropTypes.object.isRequired,
    menuLayer: PropTypes.object,
    getModifiers: PropTypes.func,
  };

  // eslint-disable-next-line @eslint-react/no-unused-class-component-members
  public getChildContext(): IComponentContext {
    return this.context;
  }

  public render() {
    return this.props.children;
  }
}

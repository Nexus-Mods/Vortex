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
import { useDispatch } from "react-redux";

import type { IComponentContext } from "../../types/IComponentContext";

import { setOpenMainPage } from "../../actions/session";
import { useExtensionContext } from "../../util/ExtensionProvider";
import { useMenuLayerContext } from "./MenuLayerContext";
import { useWindowContext } from "./WindowContext";

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

  // Set up event listeners for api events
  useEffect(() => {
    const showMainPageHandler = (pageId: string) => {
      dispatch(setOpenMainPage(pageId, false));
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
  }, [api, dispatch]);

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

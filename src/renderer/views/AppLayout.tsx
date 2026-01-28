import * as _ from "lodash";
import PropTypes from "prop-types";
import * as React from "react";
import { Button as ReactButton } from "react-bootstrap";
import { addStyle } from "react-bootstrap/lib/utils/bootstrapUtils";
import { useDispatch, useSelector } from "react-redux";

import type { IComponentContext } from "../../types/IComponentContext";
import type {
  IExtensionApi,
  IMainPageOptions,
} from "../../types/IExtensionContext";
import type { IMainPage } from "../../types/IMainPage";
import type { IModifiers } from "../../types/IModifiers";
import type { IState } from "../../types/IState";
import type { IRegisteredExtension } from "../../util/ExtensionManager";

import { setOpenMainPage } from "../../actions/session";
import { setUseModernLayout } from "../../actions/window";
import {
  ExtensionContext,
  useExtensionObjects,
} from "../../util/ExtensionProvider";
import { createQueue, MutexProvider } from "../../util/MutexContext";
import { truthy } from "../../util/util";
import { type IWindowContext, WindowProvider } from "../../util/WindowContext";
import Spinner from "../controls/Spinner";
import { ClassicLayout, ModernLayout } from "./layout";

addStyle(ReactButton, "secondary");
addStyle(ReactButton, "ad");
addStyle(ReactButton, "ghost");
addStyle(ReactButton, "link");
addStyle(ReactButton, "inverted");

export interface IBaseProps {
  className?: string;
}

export const MainContext = React.createContext<IComponentContext>({
  api: undefined,
  getModifiers: undefined,
  menuLayer: undefined,
});

const mutexQueue = createQueue();

interface ILegacyContextProviderProps {
  api: IExtensionApi;
  menuLayer: HTMLDivElement | null;
  getModifiers: () => IModifiers;
  children: React.ReactNode;
}

// This class component provides the legacy React context API (childContextTypes/getChildContext)
// required by child components using ComponentEx with contextTypes. Cannot be replaced with a
// functional component as the legacy context API is only available in class components.
// eslint-disable-next-line @eslint-react/no-class-component
class LegacyContextProvider extends React.Component<ILegacyContextProviderProps> {
  public static childContextTypes: React.ValidationMap<unknown> = {
    api: PropTypes.object.isRequired,
    menuLayer: PropTypes.object,
    getModifiers: PropTypes.func,
  };

  // eslint-disable-next-line @eslint-react/no-unused-class-component-members
  public getChildContext(): IComponentContext {
    const { api, menuLayer, getModifiers } = this.props;
    return { api, menuLayer, getModifiers };
  }

  public render() {
    return this.props.children;
  }
}

function trueFunc() {
  return true;
}

function emptyFunc() {
  return {};
}

function registerMainPage(
  _instanceGroup: undefined,
  extInfo: Partial<IRegisteredExtension>,
  icon: string,
  title: string,
  component: React.ComponentClass | React.StatelessComponent,
  options: IMainPageOptions,
): IMainPage {
  return {
    id: options.id || title,
    icon,
    title,
    component,
    propsFunc: options.props || emptyFunc,
    visible: options.visible || trueFunc,
    group: options.group,
    badge: options.badge,
    activity: options.activity,
    priority: options.priority !== undefined ? options.priority : 100,
    onReset: options.onReset,
    namespace: extInfo.namespace,
  };
}

export const AppLayout: React.FC<IBaseProps> = () => {
  const objects = useExtensionObjects<IMainPage>(
    registerMainPage,
    undefined,
    undefined,
    true,
  );

  const dispatch = useDispatch();

  const extensions = React.useContext(ExtensionContext);
  const api = extensions.getApi();

  const mainPage = useSelector((state: IState) => state.session.base.mainPage);
  const activeProfileId = useSelector(
    (state: IState) => state.settings.profiles.activeProfileId,
  );
  const nextProfileId = useSelector(
    (state: IState) => state.settings.profiles.nextProfileId,
  );
  const customTitlebar = useSelector(
    (state: IState) => state.settings.window.customTitlebar,
  );
  const useModernLayout = useSelector(
    (state: IState) => state.settings.window.useModernLayout,
  );

  const onSetOpenMainPage = React.useCallback(
    (page: string, secondary: boolean) => {
      dispatch(setOpenMainPage(page, secondary));
    },
    [dispatch],
  );

  const [hidpi, setHidpi] = React.useState(
    () => (global.screen?.width ?? 0) > 1920,
  );
  const [focused, setFocused] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState(true);

  const menuLayerRef = React.useRef<HTMLDivElement | null>(null);
  const menuObserverRef = React.useRef<MutationObserver | undefined>(undefined);
  const modifiersRef = React.useRef<IModifiers>({
    alt: false,
    ctrl: false,
    shift: false,
  });
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  const getModifiers = React.useCallback(() => modifiersRef.current, []);

  const updateModifiers = React.useCallback((event: KeyboardEvent) => {
    const newModifiers = {
      alt: event.altKey,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
    };
    if (!_.isEqual(newModifiers, modifiersRef.current)) {
      modifiersRef.current = newModifiers;
    }
  }, []);

  const updateSize = React.useCallback(() => {
    const isHidpi = (global.screen?.width ?? 0) > 1920;
    setHidpi((prev) => (prev !== isHidpi ? isHidpi : prev));
  }, []);

  const handleFocus = React.useCallback(() => {
    if (process.env.DEBUG_REACT_RENDERS !== "true") {
      setFocused(true);
    }
  }, []);

  const handleBlur = React.useCallback(() => {
    if (process.env.DEBUG_REACT_RENDERS !== "true") {
      setFocused(false);
    }
  }, []);

  const setMenuLayer = React.useCallback((ref: HTMLDivElement | null) => {
    menuLayerRef.current = ref;

    if (menuObserverRef.current !== undefined) {
      menuObserverRef.current.disconnect();
      menuObserverRef.current = undefined;
    }

    if (ref !== null) {
      let hasChildren = ref.children.length > 0;
      menuObserverRef.current = new MutationObserver(() => {
        if (menuLayerRef.current === null) {
          return;
        }
        const newHasChildren = menuLayerRef.current.children.length > 0;
        if (newHasChildren !== hasChildren) {
          hasChildren = newHasChildren;
          setMenuOpen(hasChildren);
        }
      });

      menuObserverRef.current.observe(ref, { childList: true });
    }
  }, []);

  // Set up event listeners for api events
  React.useEffect(() => {
    const showMainPageHandler = (pageId: string) => {
      onSetOpenMainPage(pageId, false);
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
  }, [api, onSetOpenMainPage]);

  // Set initial page on mount
  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    if (objects.length > 0) {
      const def = [...objects].sort(
        (lhs, rhs) => lhs.priority - rhs.priority,
      )[0];
      onSetOpenMainPage(def.title, false);
    }

    if (customTitlebar) {
      document.body.classList.add("custom-titlebar-body");
    }
  }, [objects, onSetOpenMainPage, customTitlebar]);

  // Set up window event listeners
  React.useEffect(() => {
    window.addEventListener("resize", updateSize);
    window.addEventListener("keydown", updateModifiers);
    window.addEventListener("keyup", updateModifiers);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("keydown", updateModifiers);
      window.removeEventListener("keyup", updateModifiers);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [updateSize, updateModifiers, handleFocus, handleBlur]);

  // Handle page visibility changes
  React.useEffect(() => {
    const page = objects.find((iter) => iter.id === mainPage);
    if (page !== undefined && !page.visible()) {
      onSetOpenMainPage("Dashboard", false);
    }
  }, [mainPage, objects, onSetOpenMainPage]);

  const switchingProfile =
    activeProfileId !== nextProfileId && truthy(nextProfileId);

  const contextValue: IComponentContext = React.useMemo(
    () => ({
      api,
      menuLayer: menuLayerRef.current,
      getModifiers,
    }),
    [api, getModifiers],
  );

  const windowContextValue: IWindowContext = React.useMemo(
    () => ({
      isFocused: focused,
      isMenuOpen: menuOpen,
      isHidpi: hidpi,
      setIsMenuOpen: setMenuOpen,
    }),
    [focused, menuOpen, hidpi],
  );

  return (
    <React.Suspense fallback={<Spinner className="suspense-spinner" />}>
      <WindowProvider value={windowContextValue}>
        <MainContext.Provider value={contextValue}>
          <LegacyContextProvider
            api={api}
            getModifiers={getModifiers}
            menuLayer={menuLayerRef.current}
          >
            <MutexProvider value={mutexQueue}>
              {useModernLayout ? (
                <ModernLayout
                  customTitlebar={customTitlebar}
                  objects={objects}
                  setMenuLayer={setMenuLayer}
                  switchingProfile={switchingProfile}
                />
              ) : (
                <ClassicLayout
                  customTitlebar={customTitlebar}
                  objects={objects}
                  setMenuLayer={setMenuLayer}
                  switchingProfile={switchingProfile}
                />
              )}
            </MutexProvider>

            <button
              style={{
                position: "fixed",
                bottom: 16,
                right: 16,
                zIndex: 9999,
                padding: "8px 12px",
                borderRadius: 4,
                border: "none",
                backgroundColor: "#da8e35",
                color: "white",
                cursor: "pointer",
                fontSize: 12,
              }}
              onClick={() => dispatch(setUseModernLayout(!useModernLayout))}
            >
              {useModernLayout ? "Switch to Classic" : "Switch to Modern"}
            </button>
          </LegacyContextProvider>
        </MainContext.Provider>
      </WindowProvider>
    </React.Suspense>
  );
};

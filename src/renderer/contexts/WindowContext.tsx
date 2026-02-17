import React, {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  type FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IModifiers } from "../types/IModifiers";
import type { IState } from "../types/IState";

import { setTabsMinimized } from "../actions/window";

export interface IWindowContext {
  isFocused: boolean;
  isHidpi: boolean;
  menuIsCollapsed: boolean;
  setMenuIsCollapsed: Dispatch<SetStateAction<boolean>>;
  getModifiers: () => IModifiers;
}

const defaultValue: IWindowContext = {
  isFocused: true,
  isHidpi: false,
  menuIsCollapsed: false,
  setMenuIsCollapsed: () => {},
  getModifiers: () => ({ alt: false, ctrl: false, shift: false }),
};

const WindowContext = createContext<IWindowContext>(defaultValue);

export interface IWindowProviderProps {
  children: ReactNode;
}

export const WindowProvider: FC<IWindowProviderProps> = ({ children }) => {
  const dispatch = useDispatch();
  const tabsMinimized = useSelector(
    (state: IState) => state.settings.window.tabsMinimized,
  );

  const [isHidpi, setIsHidpi] = useState(
    () => (global.screen?.width ?? 0) > 1920,
  );
  const [isFocused, setIsFocused] = useState(true);

  const modifiersRef = useRef<IModifiers>({
    alt: false,
    ctrl: false,
    shift: false,
  });

  const getModifiers = useCallback(() => modifiersRef.current, []);

  const updateModifiers = useCallback((event: KeyboardEvent) => {
    const current = modifiersRef.current;
    if (
      event.altKey !== current.alt ||
      event.ctrlKey !== current.ctrl ||
      event.shiftKey !== current.shift
    ) {
      modifiersRef.current = {
        alt: event.altKey,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
      };
    }
  }, []);

  const setMenuIsCollapsed = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const newValue =
        typeof value === "function" ? value(tabsMinimized) : value;
      dispatch(setTabsMinimized(newValue));
    },
    [tabsMinimized, dispatch],
  );

  // Window focus/blur and resize listeners
  useEffect(() => {
    const handleFocus = () => {
      if (process.env.DEBUG_REACT_RENDERS !== "true") {
        setIsFocused(true);
      }
    };

    const handleBlur = () => {
      if (process.env.DEBUG_REACT_RENDERS !== "true") {
        setIsFocused(false);
      }
    };

    const handleResize = () => {
      const newIsHidpi = (global.screen?.width ?? 0) > 1920;
      setIsHidpi((prev) => (prev !== newIsHidpi ? newIsHidpi : prev));
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", updateModifiers);
    window.addEventListener("keyup", updateModifiers);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", updateModifiers);
      window.removeEventListener("keyup", updateModifiers);
    };
  }, [updateModifiers]);

  const contextValue = useMemo(
    () => ({
      isFocused,
      isHidpi,
      menuIsCollapsed: tabsMinimized,
      setMenuIsCollapsed,
      getModifiers,
    }),
    [isFocused, isHidpi, tabsMinimized, setMenuIsCollapsed, getModifiers],
  );

  return (
    <WindowContext.Provider value={contextValue}>
      {children}
    </WindowContext.Provider>
  );
};

export const WindowConsumer = WindowContext.Consumer;

export function useWindowContext(): IWindowContext {
  return useContext(WindowContext);
}

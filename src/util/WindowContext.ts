import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
} from "react";

export interface IWindowContext {
  isFocused: boolean;
  menuIsCollapsed: boolean;
  isHidpi: boolean;
  setMenuIsCollapsed: Dispatch<SetStateAction<boolean>>;
}

const defaultValue: IWindowContext = {
  isFocused: true,
  menuIsCollapsed: false,
  isHidpi: false,
  setMenuIsCollapsed: () => {},
};

const WindowContext = createContext<IWindowContext>(defaultValue);

export const WindowProvider = WindowContext.Provider;
export const WindowConsumer = WindowContext.Consumer;

export function useWindowContext(): IWindowContext {
  return useContext(WindowContext);
}

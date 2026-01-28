import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
} from "react";

export interface IWindowContext {
  isFocused: boolean;
  isMenuOpen: boolean;
  isHidpi: boolean;
  setIsMenuOpen: Dispatch<SetStateAction<boolean>>;
}

const defaultValue: IWindowContext = {
  isFocused: true,
  isMenuOpen: false,
  isHidpi: false,
  setIsMenuOpen: () => {},
};

const WindowContext = createContext<IWindowContext>(defaultValue);

export const WindowProvider = WindowContext.Provider;
export const WindowConsumer = WindowContext.Consumer;

export function useWindowContext(): IWindowContext {
  return useContext(WindowContext);
}

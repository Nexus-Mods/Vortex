import * as React from "react";

export interface IWindowContext {
  isFocused: boolean;
  isMenuOpen: boolean;
  isHidpi: boolean;
}

const defaultValue: IWindowContext = {
  isFocused: true,
  isMenuOpen: false,
  isHidpi: false,
};

const WindowContext = React.createContext<IWindowContext>(defaultValue);

export const WindowProvider = WindowContext.Provider;
export const WindowConsumer = WindowContext.Consumer;

export function useWindowContext(): IWindowContext {
  return React.useContext(WindowContext);
}

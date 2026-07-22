import { createContext, useContext } from "react";

export interface IPageState {
  scrolled: boolean;
  collapsed: boolean;
}

export interface IPageContext extends IPageState {
  setPageState: (state: IPageState) => void;
}

export const PageContext = createContext<IPageContext>({
  scrolled: false,
  collapsed: false,
  setPageState: () => {},
});

export const usePageContext = (): IPageContext => useContext(PageContext);

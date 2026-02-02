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

  // Redirect to Dashboard when current page becomes invisible
  useEffect(() => {
    const page = mainPages.find((iter) => iter.id === mainPage);
    if (page !== undefined && !page.visible()) {
      dispatch(setOpenMainPage("Dashboard", false));
    }
  }, [mainPage, mainPages, dispatch]);

  const contextValue = useMemo(
    () => ({
      mainPages,
      mainPage,
    }),
    [mainPages, mainPage],
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

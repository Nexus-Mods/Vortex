import React, { createContext, useContext } from "react";

export interface IPageHeaderContext {
  headerPortal: () => HTMLElement;
  page: string;
}

const defaultValue: IPageHeaderContext = {
  headerPortal: () => null,
  page: "",
};

export const PageHeaderContext =
  createContext<IPageHeaderContext>(defaultValue);

export const PageHeaderProvider = PageHeaderContext.Provider;
export const PageHeaderConsumer = PageHeaderContext.Consumer;

export const usePageHeaderContext = (): IPageHeaderContext => {
  return useContext(PageHeaderContext);
};

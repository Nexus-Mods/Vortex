import { createContext, useContext } from "react";

export interface IPageScrollContext {
  scrolled: boolean;
  setScrolled: (scrolled: boolean) => void;
}

export const PageScrollContext = createContext<IPageScrollContext | null>(null);

/**
 * Whether the page's `PageScroll` region has been scrolled away from the top.
 * Returns false outside a `Page`. Use it in descendants of a `PageHeader` /
 * `PageScroll` to drive scroll-linked transitions.
 */
export const usePageScrolled = (): boolean => useContext(PageScrollContext)?.scrolled ?? false;

import { createContext, useContext } from "react";

export interface IPageContext {
  scrolled: boolean;
  compact: boolean;
  setScrolled: (scrolled: boolean) => void;
}

/** The half of the page state that consumers read; `usePage` hands this back. */
export type PageState = Omit<IPageContext, "setScrolled">;

export const PageContext = createContext<IPageContext | null>(null);

/**
 * The state a `Page` shares with its header and scroll region: whether the
 * `PageScroll` region has been scrolled away from the top, and whether the
 * header should render in its compact form — either because of that scroll, or
 * because the user asked for compact headers at all times.
 *
 * Reads only; `PageScroll` owns the writing and takes `setScrolled` off the
 * context itself. Outside a `Page` both are false.
 */
export const usePage = (): PageState =>
  useContext(PageContext) ?? { scrolled: false, compact: false };

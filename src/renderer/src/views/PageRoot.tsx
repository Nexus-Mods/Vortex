import React, { forwardRef, type HTMLAttributes, useCallback } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

export interface IPageRootProps extends HTMLAttributes<HTMLDivElement> {
  // Legacy callback ref, mirrors MainPage's domRef.
  domRef?: (ref: HTMLElement) => void;
  // Toggles the page-active / page-hidden styling. Defaults to active.
  active?: boolean;
  // When true (default) the root itself scrolls, matching the simple
  // whole-page-scroll case. Set to false when the page renders a fixed region
  // plus its own `PageRoot.Scroll` for the part that should scroll.
  scrollable?: boolean;
  // The owning page's id. When set, the root gets `id="page-<pageId>"`, mirroring
  // the id the legacy MainPage applied (some styling/selectors may rely on it).
  pageId?: string;
}

export type IPageRootScrollProps = HTMLAttributes<HTMLDivElement>;

// todo: fix for the scrollbar: https://stackoverflow.com/a/59666331/11479932

/**
 * Minimal page root: sets the ref and applies the `.main-page` layout as
 * Tailwind utilities. Unlike MainPage it does not render the header portal or
 * body wrapper, so the subtree stays flat.
 *
 * By default the root is the scroll container. For pages that need a fixed
 * region (e.g. a search bar) above the scrolling content, set
 * `scrollable={false}` and wrap the scrolling part in `PageRoot.Scroll`; any
 * sibling that isn't inside a `PageRoot.Scroll` then stays fixed.
 */
const PageRootBase = forwardRef<HTMLDivElement, IPageRootProps>(
  ({ children, className, domRef, active = true, scrollable = true, pageId, id, ...rest }, ref) => {
    const setRef = useCallback(
      (element: HTMLDivElement | null) => {
        if (typeof ref === "function") {
          ref(element);
        } else if (ref) {
          ref.current = element;
        }
        if (domRef && element) {
          domRef(element);
        }
      },
      [ref, domRef],
    );

    return (
      <div
        className={joinClasses([
          "my-0.5 mr-0.5 flex flex-1 flex-col transition-opacity",
          scrollable ? "overflow-auto" : "overflow-hidden",
          active
            ? "relative z-1000 opacity-100 delay-0"
            : "pointer-events-none invisible absolute inset-0 z-0 opacity-0",
          className,
        ])}
        id={pageId !== undefined ? `page-${pageId}` : id}
        ref={setRef}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

PageRootBase.displayName = "PageRoot";

/**
 * Scrolling region for a non-scrolling PageRoot. Fills the remaining space and
 * owns the only scrollbar; siblings outside it stay fixed. Attach `onScroll`
 * here since this is the real scroll element. The page ref stays on the top
 * PageRoot, which fully contains this region.
 *
 * Only use inside a PageRoot with `scrollable={false}`; nesting it in a
 * scrollable PageRoot stacks two scroll containers (double scrollbars).
 */
const PageRootScroll = forwardRef<HTMLDivElement, IPageRootScrollProps>(
  ({ children, className, ...rest }, ref) => (
    <div className={joinClasses(["min-h-0 flex-1 overflow-auto", className])} ref={ref} {...rest}>
      {children}
    </div>
  ),
);

PageRootScroll.displayName = "PageRoot.Scroll";

type PageRootComponent = typeof PageRootBase & { Scroll: typeof PageRootScroll };

const PageRoot = PageRootBase as PageRootComponent;
PageRoot.Scroll = PageRootScroll;

export default PageRoot;

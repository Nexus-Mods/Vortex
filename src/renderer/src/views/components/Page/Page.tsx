import React, { forwardRef, type HTMLAttributes, useCallback, useMemo, useState } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import { type IPageScrollContext, PageScrollContext } from "./Page.context";
import { PageContent } from "./PageContent";

export interface IPageProps extends HTMLAttributes<HTMLDivElement> {
  // Legacy callback ref, mirrors MainPage's domRef.
  domRef?: (ref: HTMLElement) => void;
  // Toggles the page-active / page-hidden styling. Defaults to active.
  active?: boolean;
  // When true (default) the root itself scrolls, matching the simple
  // whole-page-scroll case. Set to false when the page renders a fixed region
  // (a `PageHeader`) plus its own `PageScroll` for the part that scrolls.
  scrollable?: boolean;
  // The owning page's id. When set, the root gets `id="page-<pageId>"`, mirroring
  // the id the legacy MainPage applied (some styling/selectors may rely on it).
  pageId?: string;
  // By default the content is centred and capped at `max-w-7xl`. Set this to let
  // it fill the full width (e.g. grids that want the whole viewport).
  isFullWidth?: boolean;
}

/**
 * Minimal page root: sets the ref and applies the `.main-page` layout as
 * Tailwind utilities. Unlike MainPage it does not render the header portal or
 * body wrapper, so the subtree stays flat.
 *
 * By default the root is the scroll container. For pages that need a fixed
 * region above the scrolling content, set `scrollable={false}` and compose a
 * `PageHeader` (stays fixed) with a `PageScroll` (the part that scrolls).
 *
 * Children render inside a content box that is centred and capped at
 * `max-w-7xl`; the root itself stays full-width so its scrollbar sits at the
 * viewport edge. `className` styles that content box. Pass `isFullWidth` to
 * drop the cap for full-bleed layouts.
 */
export const Page = forwardRef<HTMLDivElement, IPageProps>(
  (
    {
      children,
      className,
      domRef,
      active = true,
      scrollable = true,
      isFullWidth = false,
      pageId,
      id,
      ...rest
    },
    ref,
  ) => {
    const [scrolled, setScrolled] = useState(false);
    const scrollContext = useMemo<IPageScrollContext>(
      () => ({ scrolled, setScrolled }),
      [scrolled],
    );

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
      <PageScrollContext.Provider value={scrollContext}>
        <div
          className={joinClasses([
            "my-0.5 mr-0.5 flex flex-1 flex-col transition-opacity",
            scrollable ? "overflow-auto" : "overflow-hidden",
            active
              ? "relative z-1000 opacity-100 delay-0"
              : "pointer-events-none invisible absolute inset-0 z-0 opacity-0",
          ])}
          id={pageId !== undefined ? `page-${pageId}` : id}
          ref={setRef}
          {...rest}
        >
          <PageContent
            className={joinClasses([className], { "flex min-h-0 flex-1 flex-col": !scrollable })}
            isFullWidth={isFullWidth || !scrollable}
          >
            {children}
          </PageContent>
        </div>
      </PageScrollContext.Provider>
    );
  },
);

Page.displayName = "Page";

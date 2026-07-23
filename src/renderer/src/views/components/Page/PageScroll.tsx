import React, { forwardRef, type HTMLAttributes, type UIEvent, useCallback } from "react";

import { usePageContext } from "./Page.context";
import { PageContent } from "./PageContent";

/**
 * Scrolling region for a non-scrolling `Page`. Fills the remaining space and
 * owns the only scrollbar; the `PageHeader` sibling stays fixed. The page ref
 * stays on the top `Page`, which fully contains this region.
 *
 * Like `Page`, it renders its children in a centred `max-w-7xl` content box
 * (opt out with `isFullWidth`); because the cap sits inside the scroll element,
 * the scrollbar stays at the viewport edge. `className` styles that content box.
 * It reports its scroll position to the `Page` so a `PageHeader` can show its
 * shadow; any `onScroll` you pass still runs.
 *
 * Only use inside a `Page` with `scrollable={false}`; nesting it in a scrollable
 * `Page` stacks two scroll containers (double scrollbars).
 */

const COLLAPSE_OVERFLOW_THRESHOLD = 64;

export type IPageScrollProps = HTMLAttributes<HTMLDivElement> & {
  isFullWidth?: boolean;
};

export const PageScroll = forwardRef<HTMLDivElement, IPageScrollProps>(
  ({ children, className, isFullWidth = false, onScroll, ...rest }, ref) => {
    const context = usePageContext();

    const handleScroll = useCallback(
      (event: UIEvent<HTMLDivElement>) => {
        const el = event.currentTarget;
        const atTop = el.scrollTop <= 0;
        const overflow = el.scrollHeight - el.clientHeight;
        const scrolled = !atTop;
        const collapsed = context.collapsed
          ? !atTop
          : !atTop && overflow > COLLAPSE_OVERFLOW_THRESHOLD;

        if (scrolled !== context.scrolled || collapsed !== context.collapsed) {
          context.setPageState({ scrolled, collapsed });
        }

        onScroll?.(event);
      },
      [context, onScroll],
    );

    return (
      <div className="min-h-0 flex-1 overflow-auto" ref={ref} onScroll={handleScroll} {...rest}>
        <PageContent className={className} isFullWidth={isFullWidth}>
          {children}
        </PageContent>
      </div>
    );
  },
);

PageScroll.displayName = "PageScroll";

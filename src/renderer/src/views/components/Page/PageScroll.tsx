import React, {
  forwardRef,
  type HTMLAttributes,
  type UIEvent,
  useCallback,
  useContext,
} from "react";

import { PageScrollContext } from "./Page.context";
import { PageContent } from "./PageContent";

export type IPageScrollProps = HTMLAttributes<HTMLDivElement> & {
  isFullWidth?: boolean;
};

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
export const PageScroll = forwardRef<HTMLDivElement, IPageScrollProps>(
  ({ children, className, isFullWidth = false, onScroll, ...rest }, ref) => {
    const context = useContext(PageScrollContext);

    const handleScroll = useCallback(
      (event: UIEvent<HTMLDivElement>) => {
        context?.setScrolled(event.currentTarget.scrollTop > 0);
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

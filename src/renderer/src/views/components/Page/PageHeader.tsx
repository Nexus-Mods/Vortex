import React, { type HTMLAttributes, type ReactNode } from "react";

import { type IPictogramName, Pictogram } from "@/ui/components/pictogram/Pictogram";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { XOr } from "@/ui/utils/types";

import { usePage } from "./Page.context";
import { PageContent } from "./PageContent";

export type IPageHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  isFullWidth?: boolean;
  children?: ReactNode | ((compact: boolean) => ReactNode);
  pictogramName?: IPictogramName;
  subtitle?: string;
} & XOr<{ title: string }, { customTitle: ReactNode | ((compact: boolean) => ReactNode) }>;

/**
 * Full-bleed header for a non-scrolling `Page`. The bar itself spans the full
 * width (so its background/shadow reach the viewport edges) and stays pinned
 * above the `PageScroll` sibling, while its content is centred and capped at
 * `max-w-8xl` so it lines up with the scrolled content: it leaves
 * `pr-scrollbar` on the right for the gutter `PageScroll` always keeps. It trades its hairline
 * for a shadow once that sibling is scrolled — unless `isFullWidth`, where
 * content reaches the bar itself, so the hairline stays and the shadow is
 * skipped.
 *
 * Scrolling also shrinks the header to its compact form, which the
 * always-compact-headers setting can instead pin on; pass a render-prop child
 * to follow that state too.
 *
 * Pass `title` for the common heading, or `customTitle` when the title needs
 * more than a string (e.g. a badge alongside it); `subtitle` renders below
 * either. `title` goes subdued once compact — `customTitle` takes a
 * render-prop so it can match. Expanded, the title drops a little to centre the
 * title and subtitle on the pictogram.
 */
export const PageHeader = ({
  children,
  className,
  isFullWidth = false,
  pictogramName,
  title,
  customTitle,
  subtitle,
  ...rest
}: IPageHeaderProps) => {
  const { compact, scrolled } = usePage();

  return (
    <div
      className={joinClasses(["relative z-10 w-full py-3 pr-scrollbar pb-3", className], {
        "border-b border-stroke-weak": !scrolled || isFullWidth,
        "shadow-md": scrolled && !isFullWidth,
      })}
      {...rest}
    >
      <PageContent className="flex items-center gap-x-2 px-6" isFullWidth={isFullWidth}>
        {!!pictogramName && (
          <Pictogram
            className={joinClasses([
              "transition-[width,height] ease-out",
              compact ? "size-7" : "size-14",
            ])}
            name={pictogramName}
            size="none"
          />
        )}

        <div className="min-w-0 grow">
          <div className="flex items-center justify-between gap-x-6">
            <div
              className={joinClasses([
                "min-w-0 transition-[margin] ease-out",
                !compact && !!pictogramName ? "mt-1" : "mt-0",
              ])}
            >
              {(typeof customTitle === "function" ? customTitle(compact) : customTitle) ?? (
                <Typography
                  appearance={compact ? "subdued" : "moderate"}
                  as="h2"
                  className="font-medium transition-colors"
                  typographyType="body-xl"
                >
                  {title}
                </Typography>
              )}
            </div>

            {typeof children === "function" ? children(compact) : children}
          </div>

          {!!subtitle && (
            <div
              aria-hidden={compact || undefined}
              className={joinClasses([
                "grid transition-[grid-template-rows,opacity] ease-out",
                compact ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]",
              ])}
            >
              <Typography appearance="subdued" className="min-h-0 truncate">
                {subtitle}
              </Typography>
            </div>
          )}
        </div>
      </PageContent>
    </div>
  );
};

PageHeader.displayName = "PageHeader";

import React, { type HTMLAttributes, type ReactNode } from "react";

import { type IPictogramName, Pictogram } from "@/ui/components/pictogram/Pictogram";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { XOr } from "@/ui/utils/types";

import { usePageScrolled } from "./Page.context";
import { PageContent } from "./PageContent";

export type IPageHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  isFullWidth?: boolean;
  children?: ReactNode | ((scrolled: boolean) => ReactNode);
  pictogramName?: IPictogramName;
  subtitle?: string;
} & XOr<{ title: string }, { customTitle: ReactNode | ((scrolled: boolean) => ReactNode) }>;

/**
 * Full-bleed header for a non-scrolling `Page`. The bar itself spans the full
 * width (so its background/shadow reach the viewport edges) and stays pinned
 * above the `PageScroll` sibling, while its content is centred and capped at
 * `max-w-8xl` so it lines up with the scrolled content. It trades its hairline
 * for a shadow once that sibling is scrolled — unless `isFullWidth`, where
 * content reaches the bar itself, so the hairline stays and the shadow is
 * skipped; pass a render-prop child to react to the scroll too.
 *
 * Pass `title` for the common heading, or `customTitle` when the title needs
 * more than a string (e.g. a badge alongside it); `subtitle` renders below
 * either. `title` goes subdued once scrolled — `customTitle` takes a
 * render-prop so it can match.
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
  const scrolled = usePageScrolled();

  return (
    <div
      className={joinClasses(["relative z-10 w-full py-3 pb-3", className], {
        "border-b border-stroke-weak": !scrolled || isFullWidth,
        "shadow-md": scrolled && !isFullWidth,
      })}
      {...rest}
    >
      <PageContent className="flex items-start gap-x-2 px-6" isFullWidth={isFullWidth}>
        {!!pictogramName && (
          <Pictogram
            className={joinClasses(["transition-[width,height]", scrolled ? "size-7" : "size-14"])}
            name={pictogramName}
            size="none"
          />
        )}

        <div className="min-w-0 grow">
          <div className="flex items-center justify-between gap-x-6">
            <div className="min-w-0">
              {(typeof customTitle === "function" ? customTitle(scrolled) : customTitle) ?? (
                <Typography
                  appearance={scrolled ? "subdued" : "moderate"}
                  as="h2"
                  className="transition-colors"
                  typographyType="heading-xs"
                >
                  {title}
                </Typography>
              )}
            </div>

            {typeof children === "function" ? children(scrolled) : children}
          </div>

          {!!subtitle && (
            <Typography
              appearance="subdued"
              className={joinClasses("truncate", { hidden: scrolled })}
            >
              {subtitle}
            </Typography>
          )}
        </div>
      </PageContent>
    </div>
  );
};

PageHeader.displayName = "PageHeader";

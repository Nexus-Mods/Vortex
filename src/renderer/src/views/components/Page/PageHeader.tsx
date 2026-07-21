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
} & XOr<{ title: string }, { customTitle: ReactNode }>;

/**
 * Full-bleed header for a non-scrolling `Page`. The bar itself spans the full
 * width (so its background/shadow reach the viewport edges) and stays pinned
 * above the `PageScroll` sibling, while its content is centred and capped at
 * `max-w-7xl` so it lines up with the scrolled content. It gains a shadow once
 * that sibling is scrolled; pass a render-prop child to react to it too.
 *
 * Pass `title` for the common heading, or `customTitle` when the title needs
 * more than a string (e.g. a badge alongside it); `subtitle` renders below
 * either.
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
      className={joinClasses([
        "relative z-10 w-full pb-3 transition-[padding]",
        scrolled ? "pt-3 shadow-md" : "border-b border-stroke-weak pt-6",
        className,
      ])}
      {...rest}
    >
      <PageContent className="flex items-center gap-x-6 px-6" isFullWidth={isFullWidth}>
        <div className="flex grow items-center gap-x-2">
          {!!pictogramName && (
            <Pictogram
              className={joinClasses([
                "transition-[width,height]",
                scrolled ? "size-7" : "size-14",
              ])}
              name={pictogramName}
              size="none"
            />
          )}

          <div className="grow">
            {customTitle ?? (
              <Typography appearance="moderate" as="h2" typographyType="heading-xs">
                {title}
              </Typography>
            )}

            {!!subtitle && (
              <Typography appearance="subdued" className={joinClasses({ hidden: scrolled })}>
                {subtitle}
              </Typography>
            )}
          </div>
        </div>

        {typeof children === "function" ? children(scrolled) : children}
      </PageContent>
    </div>
  );
};

PageHeader.displayName = "PageHeader";

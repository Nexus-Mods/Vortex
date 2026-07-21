import React, { type ReactNode } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/**
 * The centred, width-capped content box shared by `Page`, `PageHeader` and
 * `PageScroll`. The `max-w-7xl` cap lives here alone, so changing the page
 * width is a one-line edit. `isFullWidth` drops the cap for full-bleed content.
 */
export const PageContent = ({
  children,
  className,
  isFullWidth = false,
}: {
  children?: ReactNode;
  className?: string;
  isFullWidth?: boolean;
}) => (
  <div className={joinClasses(["w-full", className], { "mx-auto max-w-7xl": !isFullWidth })}>
    {children}
  </div>
);

import * as React from "react";
import type { ReactNode } from "react";

import { joinClasses } from "../../utils";

/**
 * Tab Bar component acts as a styling wrapper (and tablist role) for tabs
 */
export const TabBar = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={joinClasses([
      "tw:scrollbar tw:relative tw:flex tw:gap-x-6 tw:overflow-x-auto",
      className,
    ])}
    role="tablist"
  >
    <div className="tw:bg-stroke-neutral-translucent-subdued tw:absolute tw:inset-x-0 tw:bottom-0 tw:h-px tw:w-full" />

    {children}
  </div>
);

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
      "scrollbar relative flex gap-x-6 overflow-x-auto",
      className,
    ])}
    role="tablist"
  >
    <div className="bg-stroke-subdued absolute inset-x-0 bottom-0 h-px w-full" />

    {children}
  </div>
);

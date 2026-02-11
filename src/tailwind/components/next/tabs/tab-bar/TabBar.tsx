import type { ReactNode } from "react";

import * as React from "react";

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
      "relative flex gap-x-6 overflow-x-auto",
      className,
    ])}
    role="tablist"
  >
    <div className="absolute inset-x-0 bottom-0 h-px w-full bg-stroke-subdued" />

    {children}
  </div>
);

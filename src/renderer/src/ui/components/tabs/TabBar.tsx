import React, { type ReactNode } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import { useTabContext } from "./Tabs.context";

interface ITabBarProps {
  /** The TabButtons. */
  children: ReactNode;
  /** Extra classes for the bar. */
  className?: string;
}

/**
 * Tab Bar component acts as a styling wrapper (and tablist role) for tabs
 */
export const TabBar = ({ children, className }: ITabBarProps) => {
  const { hasBorder, tabType } = useTabContext();

  return (
    <div
      className={joinClasses(
        [
          "nxm-tab-bar",
          tabType === "primary" ? "nxm-tab-bar-primary" : "nxm-tab-bar-secondary",
          className,
        ],
        { "nxm-tab-bar-border": hasBorder },
      )}
    >
      <div className="nxm-tab-bar-scroller" role="tablist">
        {children}
      </div>
    </div>
  );
};

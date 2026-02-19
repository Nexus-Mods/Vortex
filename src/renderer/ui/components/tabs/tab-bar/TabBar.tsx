import React, { type ReactNode } from "react";

import { joinClasses } from "../../../utils/join_classes";
import { useTabContext } from "../tabs.context";

/**
 * Tab Bar component acts as a styling wrapper (and tablist role) for tabs
 */
export const TabBar = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const { tabType } = useTabContext();

  return (
    <div
      className={joinClasses([
        "nxm-tab-bar",
        tabType === "primary" ? "nxm-tab-bar-primary" : "nxm-tab-bar-secondary",
        className,
      ])}
    >
      <div className="nxm-tab-bar-scroller" role="tablist">
        {children}
      </div>
    </div>
  );
};

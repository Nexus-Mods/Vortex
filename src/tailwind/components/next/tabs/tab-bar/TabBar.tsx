import * as React from "react";
import type { ReactNode } from "react";

import { joinClasses } from "../../utils";
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
        "scrollbar nxm-tab-bar",
        tabType === "primary" ? "nxm-tab-bar-primary" : "nxm-tab-bar-secondary",
        className,
      ])}
      role="tablist"
    >
      {children}
    </div>
  );
};

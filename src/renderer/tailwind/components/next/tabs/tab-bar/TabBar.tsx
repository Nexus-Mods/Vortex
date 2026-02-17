import React, { type ReactNode } from "react";

import { joinClasses } from "../../utils";
import { useTabContext } from "../tabs.context";

/**
 * Tab Bar component acts as a styling wrapper (and tablist role) for tabs
 */
export const TabBar = ({
  children,
  className,
  size = "md",
}: {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
}) => {
  const { tabType } = useTabContext();

  return (
    <div
      className={joinClasses(
        [
          "nxm-tab-bar",
          tabType === "primary"
            ? "nxm-tab-bar-primary"
            : "nxm-tab-bar-secondary",
          className,
        ],
        { "nxm-tab-bar-sm": size === "sm" },
      )}
      role="tablist"
    >
      {children}
    </div>
  );
};

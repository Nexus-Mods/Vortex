import React, { type HTMLAttributes, type ReactNode } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

export interface IToolbarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Horizontal container for one or more {@link ToolbarGroup}s. Lays the groups
 * out in a row with consistent spacing; the visual "pill" surface lives on the
 * groups, not the toolbar itself.
 */
export const Toolbar = ({ children, className, ...props }: IToolbarProps) => (
  <div className={joinClasses(["nxm-toolbar", className])} role="toolbar" {...props}>
    {children}
  </div>
);

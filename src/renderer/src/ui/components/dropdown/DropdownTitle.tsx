import React, { type HTMLAttributes } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

export const DropdownTitle = ({
  children,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "children"> & { children: string }) => (
  <div className={joinClasses(["nxm-dropdown-title", className])} {...props}>
    {children}
  </div>
);

import React, { type HTMLAttributes } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/**
 * A band of related rows within a `PopoverPanel`. Groups are separated from one
 * another by a rule; the last one ends in padding instead, so a panel never
 * finishes on a divider. Compose the rows from `PopoverPanelGroupItem`.
 */
export const PopoverPanelGroup = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={joinClasses(["nxm-popover-panel-group", className])} {...props} />
);

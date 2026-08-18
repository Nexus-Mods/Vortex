import React, { type PropsWithChildren } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/**
 * One row of a `PopoverPanelGroup`: a label on the left and its control on the
 * right, with the label truncating rather than wrapping. Leave `label` off for a
 * row that is only a control — a reset link, say — and place it with a
 * `justify-*` class.
 */
export const PopoverPanelGroupItem = ({
  children,
  className,
  label,
}: PropsWithChildren<{ className?: string; label?: string }>) => (
  <div className={joinClasses(["nxm-popover-panel-group-item", className])}>
    {!!label && <span className="nxm-popover-panel-group-item-label">{label}</span>}

    {children}
  </div>
);

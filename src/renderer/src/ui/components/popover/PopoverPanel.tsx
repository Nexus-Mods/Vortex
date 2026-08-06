import { PopoverPanel as HeadlessPopoverPanel } from "@headlessui/react";
import React, { type ComponentProps } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/**
 * Floating panel for a Popover. Unlike a Dropdown's menu, this holds arbitrary
 * interactive content (pickers, switches, buttons) and stays open until an
 * outside click or Escape.
 *
 * `anchor` hands positioning to Headless UI's Floating UI integration, which also
 * portals the panel — so it escapes any clipping ancestor and flips itself when
 * there's no room below. Pass `anchor` to place it elsewhere.
 */
export const PopoverPanel = ({
  className,
  ...props
}: ComponentProps<typeof HeadlessPopoverPanel>) => (
  <HeadlessPopoverPanel
    anchor={{ gap: 4, to: "bottom end" }}
    className={joinClasses(["nxm-popover-panel", className])}
    {...props}
  />
);

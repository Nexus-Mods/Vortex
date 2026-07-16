import { Popover as HeadlessPopover } from "@headlessui/react";
import React, { type ComponentProps } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/**
 * Floating panel for a Popover. Unlike a Dropdown's menu, this holds arbitrary
 * interactive content (pickers, switches, buttons) and stays open until an
 * outside click or Escape. Positioned manually (absolute) until Headless UI v2
 * gives us dynamic anchor positioning.
 */
export const PopoverPanel = ({
  className,
  ...props
}: ComponentProps<typeof HeadlessPopover.Panel>) => (
  <HeadlessPopover.Panel className={joinClasses(["nxm-popover-panel", className])} {...props} />
);

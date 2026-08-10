import { Popover as HeadlessPopover } from "@headlessui/react";
import React, { type ComponentProps } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

export const Popover = ({ className, ...props }: ComponentProps<typeof HeadlessPopover>) => (
  <HeadlessPopover as="div" className={joinClasses(["nxm-popover", className])} {...props} />
);

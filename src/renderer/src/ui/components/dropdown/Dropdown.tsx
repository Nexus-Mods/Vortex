import { Menu } from "@headlessui/react";
import React, { type ComponentProps } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

export const Dropdown = ({ className, ...props }: ComponentProps<typeof Menu>) => (
  <Menu as="div" className={joinClasses(["nxm-dropdown", className])} {...props} />
);

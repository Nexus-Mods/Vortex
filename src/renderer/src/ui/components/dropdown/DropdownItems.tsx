import { Menu } from "@headlessui/react";
import React, { type ComponentProps } from "react";

import { joinClasses } from "../../utils/joinClasses";

export const DropdownItems = ({
  className,
  ...props
}: ComponentProps<typeof Menu.Items>) => (
  <Menu.Items
    className={joinClasses(["nxm-dropdown-items", className])}
    {...props}
  />
);

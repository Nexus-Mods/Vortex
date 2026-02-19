import type { ComponentProps } from "react";

import { Menu } from "@headlessui/react";

import { joinClasses } from "../../utils/join_classes";

export const DropdownItems = ({
  className,
  ...props
}: ComponentProps<typeof Menu.Items>) => (
  <Menu.Items
    className={joinClasses(["nxm-dropdown-items", className])}
    {...props}
  />
);

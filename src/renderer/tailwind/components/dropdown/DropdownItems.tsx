import type { ComponentProps } from "react";

import { Menu } from "@headlessui/react";

import { joinClasses } from "../next/utils";

export const DropdownItems = ({
  className,
  ...props
}: ComponentProps<typeof Menu.Items>) => (
  <Menu.Items
    className={joinClasses(["nxm-dropdown-items scrollbar", className])}
    {...props}
  />
);

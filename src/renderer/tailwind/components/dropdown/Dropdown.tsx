import { Menu } from "@headlessui/react";
import { type ComponentProps } from "react";

import { joinClasses } from "../next/utils";

export const Dropdown = ({
  className,
  ...props
}: ComponentProps<typeof Menu>) => (
  <Menu
    as="div"
    className={joinClasses(["nxm-dropdown", className])}
    {...props}
  />
);

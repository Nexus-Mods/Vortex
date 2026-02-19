import { Menu } from "@headlessui/react";
import { type ComponentProps } from "react";

import { joinClasses } from "../../utils/joinClasses";

// needs updating to headless v2 so we can have dynamic positioning and proper z-index usage

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

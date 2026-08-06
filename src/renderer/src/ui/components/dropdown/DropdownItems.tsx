import { MenuItems } from "@headlessui/react";
import React, { type ComponentProps } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/**
 * The menu surface of a `Dropdown`. `anchor` hands positioning to Headless UI's
 * Floating UI integration, which also portals the panel — so it escapes any
 * clipping ancestor and flips itself when there's no room below. `gap` replaces
 * the margin the stylesheet used to carry. Pass `anchor` to place it elsewhere.
 */
export const DropdownItems = ({ className, ...props }: ComponentProps<typeof MenuItems>) => (
  <MenuItems
    anchor={{ gap: 4, to: "bottom end" }}
    className={joinClasses(["nxm-dropdown-items", className])}
    {...props}
  />
);

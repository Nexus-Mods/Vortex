import React, { type HTMLAttributes } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/** Content in a dropdown that isn't an item, such as a line of text, in line with the items' icons. */
export const DropdownBlock = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={joinClasses(["nxm-dropdown-block", className])} {...props} />
);

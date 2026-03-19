import type { HTMLAttributes } from "react";

import { joinClasses } from "../../utils/joinClasses";

export const DropdownDivider = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={joinClasses(["nxm-dropdown-divider", className])}
    role="separator"
    {...props}
  />
);

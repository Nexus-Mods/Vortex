import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

export interface IBulletProps {
  /**
   * Additional classes. Tailwind utilities override the `.nxm-bullet` defaults
   * (size, rotation, colour) since the `utilities` layer sits above `components`.
   */
  className?: string;
}

/**
 * A small rotated-square dot used as an inline marker or separator, e.g. between
 * a label and an "Adult" tag. Defaults come from the `.nxm-bullet` class; pass
 * `className` to override any of them (e.g. `bg-neutral-subdued`, `size-1`).
 */
export const Bullet = ({ className }: IBulletProps) => (
  <div className={joinClasses(["nxm-bullet", className])} />
);

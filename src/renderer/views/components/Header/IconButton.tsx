import React, { forwardRef, type ButtonHTMLAttributes } from "react";

import { Icon } from "../../../../tailwind/components/next/icon";
import { joinClasses } from "../../../../tailwind/components/next/utils";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  iconPath: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, iconPath, ...props }, ref) => (
    <button
      className={joinClasses([
        "flex size-7 items-center justify-center rounded-sm text-neutral-moderate transition-colors hover:bg-surface-translucent-mid hover:text-neutral-strong",
        className,
      ])}
      ref={ref}
      {...props}
    >
      <Icon className="size-5" path={iconPath} size="none" />
    </button>
  ),
);

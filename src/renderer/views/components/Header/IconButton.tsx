import React, { forwardRef, type ButtonHTMLAttributes } from "react";

import { Icon } from "../../../../tailwind/components/next/icon";
import { Typography } from "../../../../tailwind/components/next/typography";
import { joinClasses } from "../../../../tailwind/components/next/utils";

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  className?: string;
  iconPath: string;
  itemCount?: number;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, iconPath, itemCount, ...props }, ref) => (
    <button
      className={joinClasses([
        "relative flex size-7 items-center justify-center rounded-sm text-neutral-moderate transition-colors hover:bg-surface-translucent-mid hover:text-neutral-strong",
        className,
      ])}
      ref={ref}
      {...props}
    >
      <Icon className="size-5" path={iconPath} size="none" />

      {!!itemCount && (
        <Typography
          as="span"
          className="absolute top-0 right-0 flex h-4 items-center justify-center rounded-sm bg-info-moderate px-1 leading-none font-semibold"
          typographyType="body-xs"
        >
          {itemCount}
        </Typography>
      )}
    </button>
  ),
);

import React, { forwardRef, type ButtonHTMLAttributes } from "react";

import { Icon } from "../../../ui/components/icon";
import { Typography } from "../../../ui/components/typography";
import { joinClasses } from "../../../ui/utils/join_classes";

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
        "group/icon-button relative flex size-7 items-center justify-center rounded-sm text-neutral-moderate transition-colors hover:bg-surface-translucent-mid hover:text-neutral-strong aria-expanded:bg-surface-translucent-mid aria-expanded:text-neutral-strong",
        className,
      ])}
      ref={ref}
      {...props}
    >
      <Icon className="size-5" path={iconPath} size="none" />

      {!!itemCount && (
        <Typography
          appearance="inverted"
          as="span"
          className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-neutral-inverted bg-primary-moderate px-1 leading-none font-semibold transition-colors group-hover/icon-button:bg-primary-strong group-aria-expanded/icon-button:bg-primary-strong"
          typographyType="body-xs"
        >
          {itemCount > 9 ? "9+" : itemCount}
        </Typography>
      )}
    </button>
  ),
);

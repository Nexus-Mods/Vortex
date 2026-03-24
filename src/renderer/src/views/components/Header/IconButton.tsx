import React, { forwardRef, type ButtonHTMLAttributes } from "react";

import { Icon } from "../../../ui/components/icon/Icon";
import { Typography } from "../../../ui/components/typography/Typography";
import { joinClasses } from "../../../ui/utils/joinClasses";

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  appearance?: 'primary' | 'secondary';
  className?: string;
  iconPath: string;
  itemCount?: number;
}

const appearanceMap: Record<IconButtonProps["appearance"], string> = {
  primary:
    "text-neutral-moderate hover:text-neutral-strong aria-expanded:text-neutral-strong",
  secondary:
    "text-neutral-subdued hover:text-neutral-moderate aria-expanded:text-neutral-moderate",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { appearance = "primary", className, iconPath, itemCount, ...props },
    ref,
  ) => (
    <button
      className={joinClasses([
        "group/icon-button relative flex size-7 items-center justify-center rounded-sm transition-colors hover:bg-surface-translucent-mid aria-expanded:bg-surface-translucent-mid",
        appearanceMap[appearance],
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

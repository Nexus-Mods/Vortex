import React, { type ButtonHTMLAttributes, type FC } from "react";

import { Icon } from "../../../../tailwind/components/next/icon";
import { joinClasses } from "../../../../tailwind/components/next/utils";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  iconPath: string;
}

export const IconButton: FC<IconButtonProps> = ({
  className,
  iconPath,
  ...props
}) => (
  <button
    className={joinClasses([
      "flex size-7 items-center justify-center rounded-sm text-neutral-moderate transition-colors hover:bg-surface-translucent-mid hover:text-neutral-strong",
      className,
    ])}
    {...props}
  >
    <Icon className="size-5" path={iconPath} size="none" />
  </button>
);

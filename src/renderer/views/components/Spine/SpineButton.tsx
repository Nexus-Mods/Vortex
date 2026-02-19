import React, { type ButtonHTMLAttributes, type FC } from "react";

import { Icon } from "../../../ui/components/icon/Icon";
import { joinClasses } from "../../../ui/utils/joinClasses";

interface SpineButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  iconPath: string;
  isActive?: boolean;
}

export const SpineButton: FC<SpineButtonProps> = ({
  className,
  iconPath,
  isActive,
  ...props
}) => (
  <button
    className={joinClasses([
      className,
      "flex size-12 shrink-0 items-center justify-center rounded-lg transition-colors",
      "hover:border-neutral-strong hover:bg-surface-translucent-high hover:text-neutral-strong",
      isActive
        ? "border-neutral-strong bg-surface-translucent-low text-neutral-strong"
        : "border-stroke-weak text-neutral-moderate",
    ])}
    {...props}
  >
    <Icon className="transition-colors" path={iconPath} size="lg" />
  </button>
);

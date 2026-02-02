import React, { type ButtonHTMLAttributes, type FC } from "react";

import { Icon } from "../../../../tailwind/components/next/icon";
import { Typography } from "../../../../tailwind/components/next/typography";
import { joinClasses } from "../../../../tailwind/components/next/utils";
import { useWindowContext } from "../../../contexts";

interface MenuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: string;
  iconPath: string;
  isActive?: boolean;
}

export const MenuButton: FC<MenuButtonProps> = ({
  children,
  iconPath,
  isActive,
  ...props
}) => {
  const { menuIsCollapsed } = useWindowContext();

  return (
    <button
      className={joinClasses([
        "flex h-10 items-center gap-x-3 rounded-lg px-3 transition-colors hover:bg-surface-low hover:text-neutral-moderate",
        isActive
          ? "bg-surface-low text-neutral-moderate"
          : "text-neutral-subdued",
      ])}
      {...(menuIsCollapsed ? { title: children } : {})}
      {...props}
    >
      <Icon className="shrink-0" path={iconPath} size="sm" />

      <Typography
        appearance="none"
        as="span"
        className="truncate font-semibold"
        typographyType="body-sm"
      >
        {children}
      </Typography>
    </button>
  );
};

import React, { type ButtonHTMLAttributes, type FC } from "react";

import { useWindowContext } from "@/contexts";
import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

interface MenuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: string;
  iconPath: string;
  isActive?: boolean;
}

export const MenuButton: FC<MenuButtonProps> = ({ children, iconPath, isActive, ...props }) => {
  const { menuIsCollapsed } = useWindowContext();

  return (
    <button
      className={joinClasses([
        "relative flex h-10 items-center gap-x-3 rounded-lg px-3 text-left transition-colors",
        "hover:bg-surface-mid hover:text-neutral-moderate focus-visible:z-1",
        isActive ? "bg-surface-low text-neutral-moderate" : "text-neutral-subdued",
      ])}
      {...(menuIsCollapsed ? { title: children } : {})}
      {...props}
    >
      <Icon className="shrink-0" path={iconPath} size="sm" />

      <Typography
        appearance="none"
        as="span"
        className="grow truncate font-semibold"
        typographyType="body-sm"
      >
        {children}
      </Typography>

      {/* todo show only when there is a health check item, and pick the
       * severity from the worst item rather than hardcoding warning
       * <span
       *  className={joinClasses([
       *    "size-1.5 shrink-0 rounded-full",
       *    severityStyleMap.warning.backgroundClassName,
       *  ], {
       *    'absolute top-1.5 right-1.5': menuIsCollapsed,
       *  })}
       * />
       */}
    </button>
  );
};

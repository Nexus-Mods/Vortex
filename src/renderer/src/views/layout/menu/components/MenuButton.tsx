import React, { type ButtonHTMLAttributes, type ComponentType, type FC } from "react";

import { useWindowContext } from "@/contexts";
import { Icon, type ISymbolSource, symbolProps } from "@/ui/components/icon/Icon";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

interface MenuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: string;
  /** An SVG path, for an icon the font lacks, which a given `symbol` takes the place of. */
  iconPath?: string;
  symbol?: ISymbolSource;
  isActive?: boolean;
  Badge?: ComponentType<React.PropsWithChildren<unknown>>;
}

export const MenuButton: FC<React.PropsWithChildren<MenuButtonProps>> = ({
  children,
  iconPath,
  isActive,
  symbol,
  Badge,
  ...props
}) => {
  const { menuIsCollapsed } = useWindowContext();

  return (
    <Tooltip content={children} disabled={!menuIsCollapsed} placement="right">
      <button
        className={joinClasses([
          "relative flex h-10 items-center gap-x-3 rounded-lg px-3 text-left transition-colors",
          "hover:bg-surface-mid hover:text-neutral-moderate focus-visible:z-1",
          isActive ? "bg-surface-low text-neutral-moderate" : "text-neutral-subdued",
        ])}
        {...props}
      >
        <Icon
          {...(symbol ? symbolProps(symbol) : { path: iconPath ?? "" })}
          className="shrink-0"
          size="sm"
        />

        <Typography
          as="span"
          brand="none"
          className="grow truncate font-semibold"
          typographyType="body-sm"
        >
          {children}
        </Typography>

        {Badge && <Badge />}
      </button>
    </Tooltip>
  );
};

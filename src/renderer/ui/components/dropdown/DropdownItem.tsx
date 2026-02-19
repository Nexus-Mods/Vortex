import { Menu } from "@headlessui/react";
import React, { type ComponentProps, type ReactNode } from "react";

import { joinClasses } from "../../utils/join_classes";
import type { XOr } from "../../utils/types";
import { Icon } from "../icon";

type DropdownItemProps = { children?: string; customContent?: ReactNode } & XOr<
  { leftIconPath?: string },
  { leftIcon?: ReactNode }
> &
  XOr<{ rightIconPath?: string }, { rightIcon?: ReactNode }>;

const DropdownItemIcon = ({
  icon,
  path,
}: {
  icon?: ReactNode;
  path?: string;
}) => {
  if (icon) {
    return (
      <span className="nxm-dropdown-item-icon flex items-center justify-center">
        {icon}
      </span>
    );
  }

  if (path) {
    return <Icon className="nxm-dropdown-item-icon" path={path} size="none" />;
  }

  return null;
};

export const DropdownItem = ({
  className,
  children,
  customContent,
  leftIcon,
  leftIconPath,
  rightIcon,
  rightIconPath,
  onClick,
  ...props
}: ComponentProps<typeof Menu.Item> &
  DropdownItemProps & { onClick?: () => void }) => (
  <Menu.Item {...props}>
    {({ active, disabled }) => (
      <button
        className={joinClasses(["nxm-dropdown-item", className], {
          "nxm-dropdown-item-active": active,
        })}
        disabled={disabled}
        onClick={onClick}
      >
        {customContent ?? (
          <>
            <DropdownItemIcon icon={leftIcon} path={leftIconPath} />

            {!!children && (
              <span className="nxm-dropdown-item-label">{children}</span>
            )}

            <DropdownItemIcon icon={rightIcon} path={rightIconPath} />
          </>
        )}
      </button>
    )}
  </Menu.Item>
);

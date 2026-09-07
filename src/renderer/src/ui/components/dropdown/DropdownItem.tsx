import { MenuItem } from "@headlessui/react";
import React, { type ComponentProps, type ReactNode } from "react";

import type { IButtonBrand } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { XOr } from "@/ui/utils/types";

import { dropdownItemBrandClass } from "./dropdownItemBrand";

type IDropdownItemProps = {
  children?: string;
  customContent?: ReactNode;
  brand?: IButtonBrand;
  onClick?: () => void;
} & XOr<{ leftIconPath?: string }, { leftIcon?: ReactNode }> &
  XOr<{ rightIconPath?: string }, { rightIcon?: ReactNode }>;

/**
 * What `MenuItem` takes, less the props this component states itself. `MenuItem` is
 * generic over the element it renders as, so its own `onClick` and `children` come
 * through as `any`; intersecting ours onto that would leave them `any` too.
 */
type IPassedThroughProps = Omit<ComponentProps<typeof MenuItem>, "children" | "onClick">;

const DropdownItemIcon = ({ icon, path }: { icon?: ReactNode; path?: string }) => {
  if (icon) {
    return <span className="nxm-dropdown-item-icon flex items-center justify-center">{icon}</span>;
  }

  if (path) {
    return <Icon className="nxm-dropdown-item-icon" path={path} size="none" />;
  }

  return null;
};

export const DropdownItem = ({
  brand,
  className,
  children,
  customContent,
  leftIcon,
  leftIconPath,
  rightIcon,
  rightIconPath,
  onClick,
  ...props
}: IPassedThroughProps & IDropdownItemProps) => (
  <MenuItem {...props}>
    {({ disabled, focus }) => (
      <button
        className={joinClasses(["nxm-dropdown-item", dropdownItemBrandClass(brand), className], {
          "nxm-dropdown-item-focus": focus,
        })}
        disabled={disabled}
        onClick={onClick}
      >
        {customContent ?? (
          <>
            <DropdownItemIcon icon={leftIcon} path={leftIconPath} />

            {!!children && <span className="nxm-dropdown-item-label">{children}</span>}

            <DropdownItemIcon icon={rightIcon} path={rightIconPath} />
          </>
        )}
      </button>
    )}
  </MenuItem>
);

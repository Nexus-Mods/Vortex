import { MenuItem } from "@headlessui/react";
import React, { type ComponentProps, type ReactNode } from "react";

import type { IButtonBrand } from "@/ui/components/button/Button";
import { IconSlot, type IIconProp } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";

import { dropdownItemBrandClass } from "./dropdownItemBrand";

type IDropdownItemProps = {
  children?: string;
  customContent?: ReactNode;
  brand?: IButtonBrand;
  onClick?: () => void;
  leftIcon?: IIconProp;
  rightIcon?: IIconProp;
};

/**
 * What `MenuItem` takes, less the props this component states itself. `MenuItem` is
 * generic over the element it renders as, so its own `onClick` and `children` come
 * through as `any`; intersecting ours onto that would leave them `any` too.
 */
type IPassedThroughProps = Omit<ComponentProps<typeof MenuItem>, "children" | "onClick">;

export const DropdownItem = ({
  brand,
  className,
  children,
  customContent,
  leftIcon,
  rightIcon,
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
            <IconSlot className="nxm-dropdown-item-icon" icon={leftIcon} />

            {!!children && <span className="nxm-dropdown-item-label">{children}</span>}

            <IconSlot className="nxm-dropdown-item-icon" icon={rightIcon} />
          </>
        )}
      </button>
    )}
  </MenuItem>
);

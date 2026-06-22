import { Menu } from "@headlessui/react";
import { mdiDotsVertical } from "@mdi/js";
import React, { type HTMLAttributes } from "react";

import { Button, type IButtonBrand } from "@/ui/components/button/Button";
import { Dropdown } from "@/ui/components/dropdown/Dropdown";
import { DropdownItem } from "@/ui/components/dropdown/DropdownItem";
import { DropdownItems } from "@/ui/components/dropdown/DropdownItems";
import { joinClasses } from "@/ui/utils/joinClasses";

export interface IToolbarAction {
  label: string;
  iconPath?: string;
  onClick?: () => void;
  disabled?: boolean;
  brand?: IButtonBrand;
  showLabel?: boolean;
}

export type IToolbarGroupProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  actions: IToolbarAction[];
  /**
   * Maximum number of slots to show before collapsing the tail into a kebab
   * dropdown. When there are more actions than this, the last slot becomes the
   * kebab and every remaining action moves into it. Pass `null` to disable
   * collapsing and always render every action.
   */
  maxVisible?: number | null;
};

/**
 * A rounded "pill" cluster of related toolbar controls sharing a single raised
 * surface. Renders up to `max` slots; any overflow collapses into a kebab
 * dropdown occupying the final slot.
 */
export const ToolbarGroup = ({
  actions,
  className,
  maxVisible = 7,
  ...props
}: IToolbarGroupProps) => {
  const overflows = maxVisible != null && actions.length > maxVisible;
  const visible = overflows ? actions.slice(0, maxVisible - 1) : actions;
  const hidden = overflows ? actions.slice(maxVisible - 1) : [];

  return (
    <div className={joinClasses(["nxm-toolbar-group", className])} {...props}>
      {visible.map((action) => (
        <Button
          appearance="weak"
          aria-label={!action.showLabel ? action.label : undefined}
          brand={action.brand ?? "neutral"}
          disabled={action.disabled}
          key={action.label}
          leftIconPath={action.iconPath}
          size="sm"
          onClick={action.onClick}
        >
          {action.showLabel ? action.label : undefined}
        </Button>
      ))}

      {!!hidden.length && (
        <Dropdown>
          <Menu.Button
            appearance="weak"
            aria-label="More actions"
            as={Button}
            brand="neutral"
            leftIconPath={mdiDotsVertical}
            size="sm"
          />

          <DropdownItems className="right-0 left-auto">
            {hidden.map((action) => (
              <DropdownItem
                disabled={action.disabled}
                key={action.label}
                leftIconPath={action.iconPath}
                onClick={action.onClick}
              >
                {action.label}
              </DropdownItem>
            ))}
          </DropdownItems>
        </Dropdown>
      )}
    </div>
  );
};

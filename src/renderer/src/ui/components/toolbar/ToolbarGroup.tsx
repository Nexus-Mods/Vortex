import { Menu } from "@headlessui/react";
import { mdiDotsVertical } from "@mdi/js";
import React, { type HTMLAttributes } from "react";

import { Button, type IButtonBrand } from "@/ui/components/button/Button";
import { Dropdown } from "@/ui/components/dropdown/Dropdown";
import { DropdownItem } from "@/ui/components/dropdown/DropdownItem";
import { DropdownItems } from "@/ui/components/dropdown/DropdownItems";
import { joinClasses } from "@/ui/utils/joinClasses";

import { useToolbarOverflow } from "./useToolbarOverflow.hook";

export interface IToolbarAction {
  label: string;
  iconPath?: string;
  onClick?: () => void;
  disabled?: boolean;
  brand?: IButtonBrand;
  showLabel?: boolean;
  testId?: string;
}

type IToolbarGroupProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  actions: IToolbarAction[];
  maxVisible?: number;
};

/**
 * Identity of everything about the actions that affects how wide they render:
 * the count, whether each has an icon, and any label shown as visible text.
 * Colon-separated and count-prefixed like the row's signature, so two different
 * action lists can't produce the same string and reuse each other's widths.
 */
const widthSignature = (actions: IToolbarAction[]): string =>
  [
    actions.length,
    ...actions.map(
      (action) => `${action.iconPath ? "i" : ""}${action.showLabel ? action.label : ""}`,
    ),
  ].join(":");

/**
 * A rounded "pill" cluster of related toolbar controls sharing a single raised
 * surface. Renders as many actions as fit the width the toolbar has; the rest
 * collapse into a kebab dropdown occupying the final slot.
 */
export const ToolbarGroup = ({ actions, className, maxVisible, ...props }: IToolbarGroupProps) => {
  const { groupRef, isMeasuring, visibleCount } = useToolbarOverflow({
    actionCount: actions.length,
    maxVisible,
    signature: widthSignature(actions),
  });

  const visible = actions.slice(0, visibleCount);
  const hidden = actions.slice(visibleCount);

  return (
    <div className={joinClasses(["nxm-toolbar-group", className])} ref={groupRef} {...props}>
      {visible.map((action) => (
        <Button
          appearance="weak"
          aria-label={!action.showLabel ? action.label : undefined}
          brand={action.brand ?? "neutral"}
          data-testid={action.testId}
          disabled={action.disabled}
          key={action.label}
          leftIconPath={action.iconPath}
          size="sm"
          onClick={action.onClick}
        >
          {action.showLabel ? action.label : undefined}
        </Button>
      ))}

      {/* Kept mounted through the measuring pass so its width is measured too. */}
      {(isMeasuring || !!hidden.length) && (
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

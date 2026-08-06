import { Menu } from "@headlessui/react";
import { mdiDotsHorizontal } from "@mdi/js";
import React, { type HTMLAttributes } from "react";

import { Button, type IButtonBrand } from "@/ui/components/button/Button";
import { Dropdown } from "@/ui/components/dropdown/Dropdown";
import { DropdownItem } from "@/ui/components/dropdown/DropdownItem";
import { DropdownItems } from "@/ui/components/dropdown/DropdownItems";
import { TooltipDelayGroup } from "@/ui/components/tooltip/TooltipDelayGroup";
import { joinClasses } from "@/ui/utils/joinClasses";

import { ToolbarButton } from "./ToolbarButton";
import { useToolbarOverflow } from "./useToolbarOverflow.hook";

export interface IToolbarAction {
  label: string;
  iconPath?: string;
  onClick?: () => void;
  disabled?: boolean;
  brand?: IButtonBrand;
  showLabel?: boolean;
  testId?: string;
  isLoading?: boolean;
  pinned?: boolean;
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
 * collapse into a kebab dropdown occupying the final slot. A `pinned` action is
 * held back from that, whatever its position.
 */
export const ToolbarGroup = ({ actions, className, maxVisible, ...props }: IToolbarGroupProps) => {
  const { groupRef, isMeasuring, visible } = useToolbarOverflow({
    maxVisible,
    pinned: actions.map((action) => action.pinned ?? false),
    signature: widthSignature(actions),
  });

  const visibleActions = actions.filter((_, index) => visible.has(index));
  const hiddenActions = actions.filter((_, index) => !visible.has(index));

  return (
    <TooltipDelayGroup
      as="div"
      className={joinClasses(["nxm-toolbar-group", className])}
      ref={groupRef}
      {...props}
    >
      {visibleActions.map((action) => (
        <ToolbarButton
          appearance="weak"
          brand={action.brand ?? "neutral"}
          data-testid={action.testId}
          disabled={action.disabled}
          isLoading={action.isLoading}
          key={action.label}
          label={action.label}
          leftIconPath={action.iconPath}
          showLabel={action.showLabel}
          onClick={action.onClick}
        />
      ))}

      {/* Kept mounted through the measuring pass so its width is measured too. */}
      {(isMeasuring || !!hiddenActions.length) && (
        <Dropdown>
          <Menu.Button
            appearance="weak"
            aria-label="More actions"
            as={Button}
            brand="neutral"
            leftIconPath={mdiDotsHorizontal}
            size="sm"
          />

          <DropdownItems className="right-0 left-auto">
            {hiddenActions.map((action) => (
              <DropdownItem
                disabled={action.disabled || action.isLoading}
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
    </TooltipDelayGroup>
  );
};

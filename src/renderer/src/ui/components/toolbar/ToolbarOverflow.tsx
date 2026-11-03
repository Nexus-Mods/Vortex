import React from "react";
import { useTranslation } from "react-i18next";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";

import type { IToolbarAction } from "./ToolbarGroup";
import { type IToolbarMenuPinning, ToolbarMenuContent } from "./ToolbarMenu";
import { TOOLBAR_OVERFLOW_ATTRIBUTE } from "./useToolbarOverflow.hook";

interface IToolbarOverflowProps {
  actions: IToolbarAction[];
  /** Present where the user has a say in which actions sit on the bar. */
  pinning?: IToolbarMenuPinning;
}

/**
 * The actions a group had no room for, as a menu hung off a kebab button. They
 * arrive already ordered and belong together, so they go in as a single group, with
 * pins and a reset link where pinning is offered.
 */
export const ToolbarOverflow = ({ actions, pinning }: IToolbarOverflowProps) => {
  const { t } = useTranslation();
  const label = t("More actions");

  return (
    // The wrapper is what the group lays out, so it is what the group measures.
    <Popover {...{ [TOOLBAR_OVERFLOW_ATTRIBUTE]: true }}>
      <PopoverButton
        appearance="weak"
        aria-haspopup="menu"
        aria-label={label}
        brand="neutral"
        data-testid="toolbar-overflow"
        leftIcon="more_horiz"
      />

      <PopoverPanel className="nxm-popover-panel-dropdown">
        {({ close }) => (
          <ToolbarMenuContent actions={actions} label={label} pinning={pinning} onSelect={close} />
        )}
      </PopoverPanel>
    </Popover>
  );
};

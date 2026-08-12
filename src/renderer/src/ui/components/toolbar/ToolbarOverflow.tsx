import { mdiDotsHorizontal } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverMenu } from "@/ui/components/popover/PopoverMenu";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";

import type { IToolbarAction } from "./ToolbarGroup";
import { TOOLBAR_OVERFLOW_ATTRIBUTE } from "./useToolbarOverflow.hook";

interface IToolbarOverflowProps {
  actions: IToolbarAction[];
}

/**
 * The actions a group had no room for, as a menu hung off a kebab button. They
 * arrive already ordered and belong together, so they go in as a single group.
 */
export const ToolbarOverflow = ({ actions }: IToolbarOverflowProps) => {
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
        leftIconPath={mdiDotsHorizontal}
      />

      <PopoverPanel className="nxm-popover-panel-dropdown">
        {({ close }) => <PopoverMenu actions={[actions]} label={label} onSelect={close} />}
      </PopoverPanel>
    </Popover>
  );
};

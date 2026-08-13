import React from "react";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";

import { ToolbarButton, type IToolbarButtonProps } from "./ToolbarButton";
import type { IToolbarPanel } from "./ToolbarGroup";
import { TOOLBAR_CONTROL_ATTRIBUTE } from "./useToolbarOverflow.hook";

export type IToolbarPanelButtonProps = IToolbarButtonProps & {
  panel: IToolbarPanel;
  panelRole?: "dialog" | "menu";
};

/**
 * A toolbar control that opens a floating panel instead of running an action.
 *
 * The trigger is a {@link ToolbarButton} rendered as the popover's button, so the
 * row can't tell the two kinds of action apart: same size, same tooltip, same
 * accessible name. Headless UI anchors and portals the panel, so it escapes the
 * toolbar's clipping ancestors and flips itself when there's no room below.
 *
 * `panelRole` says which kind of panel it is, as it does on a menu row: rows of
 * settings by default, or a menu, which is styled as a dropdown and left to focus
 * its own first row.
 */
export const ToolbarPanelButton = ({ panel, panelRole, ...props }: IToolbarPanelButtonProps) => {
  const isMenu = panelRole === "menu";

  return (
    // The wrapper is what the group lays out, so it is what the group measures.
    <Popover {...{ [TOOLBAR_CONTROL_ATTRIBUTE]: true }}>
      {({ open }) => (
        <>
          <ToolbarButton
            {...props}
            aria-haspopup={panelRole ?? "dialog"}
            as={PopoverButton}
            tooltipDisabled={open}
          />

          <PopoverPanel
            className={isMenu ? "nxm-popover-panel-dropdown" : "nxm-popover-panel-controls"}
            focus={!isMenu}
          >
            {({ close }) => <>{panel({ close, dismiss: close })}</>}
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
};

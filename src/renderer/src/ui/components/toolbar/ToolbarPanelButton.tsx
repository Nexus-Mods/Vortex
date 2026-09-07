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
 * Moves focus into the panel as it opens, so opening from the keyboard lands in the
 * rows rather than leaving them to be tabbed to.
 *
 * `PopoverPanel`'s own `focus` prop does this, but it also closes the panel the moment
 * focus leaves it — and a control inside the panel that opens its own floating list,
 * as the display options picker does, reads as exactly that. Clicking the picker shut
 * the panel it was in. Doing the focus here keeps the keyboard entry and leaves closing
 * to an outside click or Escape.
 *
 * Declared out here so the ref keeps one identity: an inline callback would be a new
 * ref every render, and refocus the panel each time — taking focus back off whatever
 * the user had just opened inside it.
 *
 * Only for a panel of settings. A panel that is a menu focuses its own first row, so it
 * doesn't take the ref.
 */
const focusPanel = (element: HTMLElement | null) => {
  if (element === null) {
    return;
  }

  // Headless UI keeps `tabIndex` to itself as a prop, so it goes on the element. The
  // panel is a plain div and won't take focus without it.
  element.tabIndex = -1;
  element.focus({ preventScroll: true });
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
export const ToolbarPanelButton = ({
  panel,
  panelRole,
  onClick,
  ...props
}: IToolbarPanelButtonProps) => {
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
            onClick={open ? undefined : onClick}
          />

          <PopoverPanel
            className={isMenu ? "nxm-popover-panel-dropdown" : "nxm-popover-panel-controls"}
            ref={isMenu ? undefined : focusPanel}
          >
            {({ close }) => <>{panel({ close, dismiss: close })}</>}
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
};

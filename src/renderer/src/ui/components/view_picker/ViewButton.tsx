import React, { type ButtonHTMLAttributes, type MouseEvent, useState } from "react";

import {
  ContextMenu,
  contextMenuPosition,
  type IContextMenuPosition,
} from "@/ui/components/context_menu/ContextMenu";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import type { IMenuAction } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { hasModifierKey } from "@/ui/utils/hasModifierKey";
import { joinClasses } from "@/ui/utils/joinClasses";

interface IViewButtonMenu {
  /** Names the menu and its "…" button, for screen readers. */
  label: string;
  /** What can be done with the view, in groups. */
  actions: IMenuAction[][];
}

export type IViewButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-pressed" | "children" | "type"
> & {
  /** The view's name. */
  children: string;
  /** Whether it's the open view. */
  isPressed: boolean;
  /** For a view of the user's own: a menu of what can be done with it. */
  menu?: IViewButtonMenu;
};

/**
 * A view in a `ViewPicker`, lit while it's the open one. With a `menu`, a "…" beside it in the
 * same pill opens the menu without opening the view, and so does a right-click, Shift+F10 or the
 * Down arrow; the "…" is out of the Tab order, so the picker stays one Tab stop. Without one, a
 * right-click does nothing.
 */
export const ViewButton = ({
  children,
  className,
  isPressed,
  menu,
  onContextMenu,
  onKeyDown,
  ...rest
}: IViewButtonProps) => {
  const [contextMenu, setContextMenu] = useState<IContextMenuPosition>();

  const button = (
    <button
      {...rest}
      aria-pressed={isPressed}
      className={joinClasses([menu ? "nxm-view-button-label" : "nxm-view-button", className])}
      type="button"
      onContextMenu={(event) => {
        onContextMenu?.(event);
        if (!menu) {
          event.preventDefault();
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!menu || event.key !== "ArrowDown" || event.defaultPrevented || hasModifierKey(event)) {
          return;
        }

        event.preventDefault();
        const { left, bottom } = event.currentTarget.getBoundingClientRect();
        setContextMenu({ x: left, y: bottom, element: event.currentTarget });
      }}
    >
      {children}
    </button>
  );

  if (!menu) {
    return button;
  }

  return (
    <Popover
      className="nxm-view-button nxm-view-button-menu"
      onContextMenu={(event: MouseEvent) => {
        if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) {
          return;
        }

        event.preventDefault();
        setContextMenu(contextMenuPosition(event));
      }}
    >
      {button}

      <PopoverButton
        appearance="weak"
        aria-haspopup="menu"
        aria-label={menu.label}
        brand="neutral"
        leftIcon="more_horiz"
        size="sm"
        tabIndex={-1}
      />

      <PopoverPanel anchor={{ gap: 4, to: "bottom start" }} className="nxm-popover-panel-dropdown">
        {({ close }) => <PopoverMenu actions={menu.actions} label={menu.label} onSelect={close} />}
      </PopoverPanel>

      <ContextMenu position={contextMenu} onClose={() => setContextMenu(undefined)}>
        {(close) => <PopoverMenu actions={menu.actions} label={menu.label} onSelect={close} />}
      </ContextMenu>
    </Popover>
  );
};

import { PopoverButton as HeadlessPopoverButton } from "@headlessui/react";
import { mdiDotsHorizontal } from "@mdi/js";
import React, { type ButtonHTMLAttributes, type MouseEvent, useState } from "react";

import { Button } from "@/ui/components/button/Button";
import {
  ContextMenu,
  contextMenuPosition,
  type IContextMenuPosition,
} from "@/ui/components/context_menu/ContextMenu";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import type { IMenuAction } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
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
 * A view in a `ViewPicker`, lit while it's the open one. With a `menu`, a "…" nested inside it,
 * as a menu row's pin is, opens the menu without opening the view, and so does a right-click,
 * Shift+F10 or the Down arrow; the "…" is out of the Tab order, so the picker stays one Tab stop.
 * Without one, a right-click does nothing.
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
      aria-label={menu ? children : rest["aria-label"]}
      aria-pressed={isPressed}
      className={joinClasses(["nxm-view-button", className], {
        "nxm-view-button-menu": !!menu,
      })}
      type="button"
      onContextMenu={(event) => {
        onContextMenu?.(event);
        event.preventDefault();
        if (menu) {
          setContextMenu(contextMenuPosition(event));
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!menu || event.key !== "ArrowDown") {
          return;
        }

        event.preventDefault();
        const { left, bottom } = event.currentTarget.getBoundingClientRect();
        setContextMenu({ x: left, y: bottom, element: event.currentTarget });
      }}
    >
      {menu ? <span>{children}</span> : children}

      {!!menu && (
        <HeadlessPopoverButton
          nested
          appearance="weak"
          aria-haspopup="menu"
          aria-label={menu.label}
          as={Button}
          brand="neutral"
          leftIconPath={mdiDotsHorizontal}
          size="sm"
          tabIndex={-1}
          onClick={(event: MouseEvent) => event.stopPropagation()}
        />
      )}
    </button>
  );

  if (!menu) {
    return button;
  }

  return (
    <Popover className="flex">
      {button}

      <PopoverPanel anchor={{ gap: 4, to: "bottom start" }} className="nxm-popover-panel-dropdown">
        {({ close }) => <PopoverMenu actions={menu.actions} label={menu.label} onSelect={close} />}
      </PopoverPanel>

      <ContextMenu position={contextMenu} onClose={() => setContextMenu(undefined)}>
        {(close) => <PopoverMenu actions={menu.actions} label={menu.label} onSelect={close} />}
      </ContextMenu>
    </Popover>
  );
};

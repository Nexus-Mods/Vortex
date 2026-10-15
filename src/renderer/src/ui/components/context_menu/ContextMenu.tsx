import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import React, { type MouseEvent, type ReactNode, useLayoutEffect, useRef } from "react";

/** Portalled where the tooltips are, so nothing clips it. */
const OVERLAY_HOST_ID = "overlays";
/** Gap kept between the menu and the window edges. */
const COLLISION_PADDING = 8;

/** Where a context menu opens, in the window's coordinates. */
export interface IContextMenuPosition {
  x: number;
  y: number;
  /** The element it was opened from, whose scrolling ancestors close it as they scroll. */
  element?: Element;
}

/**
 * Where a `contextmenu` event asks for a menu: at the pointer, or, from the keyboard (Shift+F10
 * or the Menu key), under the start of the element with focus. Chromium marks a keyboard one
 * with no button, and places it mid-element; one with no position at all is the keyboard's too.
 */
/** Whether a context menu was asked for from the keyboard (Shift+F10 or the Menu key). */
export const openedFromKeyboard = (event: MouseEvent<Element>): boolean =>
  event.button === -1 || (event.clientX === 0 && event.clientY === 0);

export const contextMenuPosition = (event: MouseEvent<Element>): IContextMenuPosition => {
  if (!openedFromKeyboard(event)) {
    return { x: event.clientX, y: event.clientY, element: event.currentTarget };
  }

  const element = event.target instanceof Element ? event.target : event.currentTarget;
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.bottom, element: event.currentTarget };
};

interface IContextMenuProps {
  /** Where it's open; unset, it's closed. */
  position: IContextMenuPosition | undefined;
  /** Closes it, on Escape, a press outside it, a scroll, or a row chosen. */
  onClose: () => void;
  /** Its content, such as a `PopoverMenu`, given the way to close it once a row is chosen. */
  children: (close: () => void) => ReactNode;
}

/**
 * A menu opened by a right-click, or Shift+F10 or the Menu key, at the place it was asked
 * for: a dropdown's panel, holding whatever menu it's given. It keeps focus while open and
 * hands it back on closing, to what had it before, such as the row it was opened from: noted
 * in a layout effect, before the menu's own effect focuses its first row, which a focus
 * manager noting it later would take for what had focus.
 *
 * It closes as the page scrolls, as it's fixed where it opened, and a press in a panel one of
 * its rows opened isn't outside it. A right-click in it opens no other. Controlled: the caller
 * keeps where it's open, from `contextMenuPosition`, and clears it on `onClose`.
 */
export const ContextMenu = ({ position, onClose, children }: IContextMenuProps) => {
  const open = position !== undefined;

  const { context, floatingStyles, refs } = useFloating({
    middleware: [
      offset(2),
      flip({ padding: COLLISION_PADDING }),
      shift({ padding: COLLISION_PADDING }),
      size({
        apply({
          availableHeight,
          elements,
        }: {
          availableHeight: number;
          elements: { floating: HTMLElement };
        }) {
          elements.floating.style.maxHeight = `${availableHeight}px`;
        },
        padding: COLLISION_PADDING,
      }),
    ],
    open,
    placement: "bottom-start",
    onOpenChange: (next) => {
      if (!next) {
        onClose();
      }
    },
    whileElementsMounted: autoUpdate,
  });

  useLayoutEffect(() => {
    if (position !== undefined) {
      refs.setPositionReference({
        contextElement: position.element,
        getBoundingClientRect: () =>
          DOMRect.fromRect({ x: position.x, y: position.y, width: 0, height: 0 }),
      });
    }
  }, [position, refs]);

  const { getFloatingProps } = useInteractions([useDismiss(context, { ancestorScroll: true })]);

  const returnTo = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }

    const focused = document.activeElement;
    returnTo.current = focused instanceof HTMLElement ? focused : null;

    return () => {
      if (returnTo.current?.isConnected) {
        returnTo.current.focus({ preventScroll: true });
      }
      returnTo.current = null;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <FloatingPortal id={OVERLAY_HOST_ID}>
      <FloatingFocusManager context={context} initialFocus={-1} returnFocus={false}>
        <div
          className="nxm-popover-panel nxm-popover-panel-dropdown"
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps({ onContextMenu: (event) => event.preventDefault() })}
        >
          {children(onClose)}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
};

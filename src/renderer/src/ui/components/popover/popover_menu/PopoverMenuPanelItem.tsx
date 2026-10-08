import { PopoverButton as HeadlessPopoverButton } from "@headlessui/react";
import React, { forwardRef, type KeyboardEvent, useEffect, useRef } from "react";

import { dropdownItemBrandClass } from "@/ui/components/dropdown/dropdownItemBrand";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { joinClasses } from "@/ui/utils/joinClasses";

import type { IPopoverMenuItemProps, IPopoverPanel } from "./PopoverMenu.types";
import { PopoverMenuItemContent } from "./PopoverMenuItemContent";
import { takeFocus } from "./takeFocus";

const HOVER_CLOSE_DELAY = 150;

/**
 * A row whose panel opens beside it, leaving the menu itself open — the panel is
 * portalled, but Headless UI registers it as part of the enclosing popover, so
 * reaching into it doesn't read as leaving the menu.
 *
 * Pointing at the row opens it, as a menu should. Headless UI's popover is driven by
 * clicks alone, so hovering reaches for the button the same way the keyboard does —
 * activating it — rather than trying to drive the machine from outside.
 */
export const PopoverMenuPanelItem = forwardRef<
  HTMLButtonElement,
  Omit<IPopoverMenuItemProps, "reservesChevron"> & { disabled: boolean; panel: IPopoverPanel }
>(({ action, disabled, hasFocus, panel, tabIndex, onTakeFocus, onSelect }, ref) => {
  const isSubmenu = action.panelRole === "menu";
  const keepsPin = disabled && !!action.pin;
  const hoverToggleRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const cancelHover = () => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
  };

  // A row can be unmounted mid-hover — the menu closing, or its actions changing —
  // and a timer left running would then toggle a button that has gone.
  useEffect(() => cancelHover, []);

  const isOpen = () => buttonRef.current?.getAttribute("aria-expanded") === "true";

  const toggleByHover = () => {
    hoverToggleRef.current = true;
    buttonRef.current?.click();
    hoverToggleRef.current = false;
  };

  const closeAfterHover = () => {
    cancelHover();
    timerRef.current = setTimeout(() => isOpen() && toggleByHover(), HOVER_CLOSE_DELAY);
  };

  return (
    <Popover className="flex flex-col">
      {({ open }) => (
        <>
          <HeadlessPopoverButton
            aria-disabled={keepsPin || undefined}
            aria-haspopup={action.panelRole ?? "dialog"}
            className={joinClasses(["nxm-dropdown-item", dropdownItemBrandClass(action.brand)], {
              "nxm-dropdown-item-focus": hasFocus || open,
            })}
            disabled={disabled && !keepsPin}
            ref={(element: HTMLButtonElement | null) => {
              buttonRef.current = element;

              if (typeof ref === "function") {
                ref(element);
              } else if (ref) {
                ref.current = element;
              }
            }}
            role="menuitem"
            tabIndex={tabIndex}
            onClick={(event) => {
              // A real click would close what hover opened; hover's own must still pass.
              if (keepsPin || (isOpen() && !hoverToggleRef.current)) {
                event.preventDefault();
              }
            }}
            onFocus={onTakeFocus}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
              if (event.key !== "ArrowRight") {
                return;
              }

              // Ahead of Headless UI's own handler, which is skipped once this is defaulted.
              event.preventDefault();
              event.currentTarget.click();
            }}
            onMouseEnter={(event) => {
              cancelHover();

              // The open panel owns the focus; pulling it back to the row dismisses it.
              if (isOpen()) {
                return;
              }

              takeFocus(event.currentTarget);

              if (!disabled) {
                toggleByHover();
              }
            }}
            onMouseLeave={closeAfterHover}
          >
            <PopoverMenuItemContent
              hasPanel
              reservesChevron
              action={action}
              hasFocus={hasFocus}
              onSelect={onSelect}
            />
          </HeadlessPopoverButton>

          <PopoverPanel
            anchor={{ gap: 8, to: "right start" }}
            className={isSubmenu ? "nxm-popover-panel-dropdown" : "nxm-popover-panel-controls"}
            focus={!isSubmenu}
            onMouseEnter={cancelHover}
            onMouseLeave={closeAfterHover}
          >
            {({ close }) => {
              // Inner before outer: each close focuses its own trigger before React
              // flushes the unmount, so closing outwards leaves focus on the control
              // that started the chain. The other order focuses a row that is about
              // to go away, and focus falls to the body.
              const dismiss = () => {
                close();
                onSelect();
              };

              return <>{panel({ close, dismiss })}</>;
            }}
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
});

PopoverMenuPanelItem.displayName = "PopoverMenuPanelItem";

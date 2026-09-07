import { PopoverButton as HeadlessPopoverButton } from "@headlessui/react";
import { mdiChevronRight, mdiPinOffOutline, mdiPinOutline } from "@mdi/js";
import React, {
  forwardRef,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useRef,
} from "react";

import type { IButtonBrand } from "@/ui/components/button/Button";
import { dropdownItemBrandClass } from "@/ui/components/dropdown/dropdownItemBrand";
import { Icon } from "@/ui/components/icon/Icon";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { XOr } from "@/ui/utils/types";

/**
 * The contents of the floating panel an action opens. Whatever rendered the action
 * anchors the panel to it — a toolbar button, or its row in a menu — so the panel
 * doesn't have to know where it was opened from.
 *
 * `close` dismisses the panel. `dismiss` also dismisses whatever the panel was
 * opened from, for a control that ends the interaction rather than adjusting
 * something: picking a destination should put the whole stack away, where toggling
 * a setting should leave it standing.
 */
export type IPopoverPanel = (props: { close: () => void; dismiss: () => void }) => ReactNode;

interface IMenuActionBase {
  label: string;
  iconPath?: string;
  disabled?: boolean;
  isLoading?: boolean;
  panelRole?: "dialog" | "menu";
  brand?: IButtonBrand;
  pin?: {
    pinned: boolean;
    label: string;
    onToggle: () => void;
  };
}

/**
 * One activatable thing in a menu. Activating it either runs `onClick` or opens
 * `panel`; activation has a single meaning, so the two are mutually exclusive.
 */
export type IMenuAction = IMenuActionBase &
  XOr<{ onClick?: () => void }, { panel?: IPopoverPanel }>;

interface IPopoverMenuItemProps {
  action: IMenuAction;
  hasFocus: boolean;
  tabIndex: number;
  onTakeFocus: () => void;
  onSelect: () => void;
}

const HOVER_CLOSE_DELAY = 150;

/**
 * Hovering a row makes it the one the keyboard is on, so the pointer and the arrow
 * keys can't end up pointing at different rows — the menu shows a single focused row
 * either way, and arrowing on from a hovered row carries on from there.
 */
const takeFocus = (row: HTMLButtonElement) => row.focus({ preventScroll: true });

const PopoverMenuItemContent = ({
  action,
  hasPanel = false,
  hasFocus,
}: {
  action: IMenuAction;
  hasPanel?: boolean;
  hasFocus: boolean;
}) => (
  <>
    {!!action.iconPath && (
      <Icon className="nxm-dropdown-item-icon" path={action.iconPath} size="none" />
    )}

    <span className="nxm-dropdown-item-label">{action.label}</span>

    {!!action.pin && <PopoverMenuItemPin hasFocus={hasFocus} pin={action.pin} />}

    <Icon
      className={joinClasses("nxm-dropdown-item-icon", {
        "nxm-dropdown-item-chevron-hidden": !hasPanel,
      })}
      path={mdiChevronRight}
      size="none"
    />
  </>
);

/**
 * The pin toggle within a row. Tabbable on the row the keyboard is on rather than the
 * row the menu keeps its own tab stop on — which is always the first — so arrowing
 * down and pressing Tab reaches the pin of the row you are actually on. Reaching for
 * the row's `tabIndex` instead left every other pin unreachable, and Tab took focus
 * out of the panel, closing the menu.
 */
const PopoverMenuItemPin = ({
  hasFocus,
  pin,
}: {
  hasFocus: boolean;
  pin: NonNullable<IMenuAction["pin"]>;
}) => {
  const toggle = (event: SyntheticEvent) => {
    // The row would otherwise run what the row says: this is a control within it,
    // and activating it says only what it says.
    event.preventDefault();
    event.stopPropagation();
    pin.onToggle();
  };

  return (
    <span
      aria-label={pin.label}
      aria-pressed={pin.pinned}
      className="nxm-dropdown-item-pin"
      role="button"
      tabIndex={hasFocus ? 0 : -1}
      onClick={toggle}
      onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
        if (["Enter", " "].includes(event.key)) {
          toggle(event);
        }
      }}
    >
      <Icon path={pin.pinned ? mdiPinOffOutline : mdiPinOutline} size="none" />
    </span>
  );
};

/**
 * A row whose panel opens beside it, leaving the menu itself open — the panel is
 * portalled, but Headless UI registers it as part of the enclosing popover, so
 * reaching into it doesn't read as leaving the menu.
 *
 * Pointing at the row opens it, as a menu should. Headless UI's popover is driven by
 * clicks alone, so hovering reaches for the button the same way the keyboard does —
 * activating it — rather than trying to drive the machine from outside.
 */
const PopoverMenuPanelItem = forwardRef<
  HTMLButtonElement,
  IPopoverMenuItemProps & { disabled: boolean; panel: IPopoverPanel }
>(({ action, disabled, hasFocus, panel, tabIndex, onTakeFocus, onSelect }, ref) => {
  const isSubmenu = action.panelRole === "menu";
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
            aria-haspopup={action.panelRole ?? "dialog"}
            className={joinClasses(["nxm-dropdown-item", dropdownItemBrandClass(action.brand)], {
              "nxm-dropdown-item-focus": hasFocus || open,
            })}
            disabled={disabled}
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
              if (isOpen() && !hoverToggleRef.current) {
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
            <PopoverMenuItemContent hasPanel action={action} hasFocus={hasFocus} />
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

/**
 * One row of a {@link PopoverMenu}. A plain action runs and dismisses the menu;
 * one with a panel opens it alongside instead.
 */
export const PopoverMenuItem = forwardRef<HTMLButtonElement, IPopoverMenuItemProps>(
  ({ action, hasFocus, tabIndex, onTakeFocus, onSelect }, ref) => {
    const disabled = !!action.disabled || !!action.isLoading;

    if (action.panel) {
      return (
        <PopoverMenuPanelItem
          action={action}
          disabled={disabled}
          hasFocus={hasFocus}
          panel={action.panel}
          ref={ref}
          tabIndex={tabIndex}
          onSelect={onSelect}
          onTakeFocus={onTakeFocus}
        />
      );
    }

    return (
      <button
        className={joinClasses(["nxm-dropdown-item", dropdownItemBrandClass(action.brand)], {
          "nxm-dropdown-item-focus": hasFocus,
        })}
        disabled={disabled}
        ref={ref}
        role="menuitem"
        tabIndex={tabIndex}
        type="button"
        onClick={() => {
          action.onClick?.();
          onSelect();
        }}
        onFocus={onTakeFocus}
        onMouseEnter={(event) => takeFocus(event.currentTarget)}
      >
        <PopoverMenuItemContent action={action} hasFocus={hasFocus} />
      </button>
    );
  },
);

PopoverMenuItem.displayName = "PopoverMenuItem";

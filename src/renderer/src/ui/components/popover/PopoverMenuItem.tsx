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
  /** The row's text, and its accessible name. */
  label: string;
  /** The icon before the label, as an SVG path. */
  iconPath?: string;
  /** Drawn in place of `iconPath`, for an icon a single path can't draw, such as a logo. */
  icon?: ReactNode;
  /** Turns the action off; a row with a pin stays reachable so it can still be pinned. */
  disabled?: boolean;
  /** Turns the action off while something it started is under way, as `disabled` does. */
  isLoading?: boolean;
  /** What the panel is, for `aria-haspopup`: a "menu" opens as a submenu, a "dialog" by default. */
  panelRole?: "dialog" | "menu";
  /** Colours the row for a brand, such as a premium action. */
  brand?: IButtonBrand;
  /** A pin toggle at the row's end, for pinning the action outside the menu. */
  pin?: {
    /** Whether the action is pinned now, which picks the pin or unpin icon. */
    pinned: boolean;
    /** The toggle's accessible name. */
    label: string;
    /** Pins or unpins the action. */
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
  /** What the row shows, and runs or opens. */
  action: IMenuAction;
  /** Whether the row is the one the menu has focused, which it highlights. */
  hasFocus: boolean;
  /** Keeps a chevron's room on a row without one, so its pin lines up with a submenu row's. */
  reservesChevron: boolean;
  /** The row's place in the tab order: the menu keeps its tab stop on the first row. */
  tabIndex: number;
  /** Tells the menu the row has taken focus. */
  onTakeFocus: () => void;
  /** Dismisses the menu once the row's action has run. */
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
  reservesChevron,
}: {
  action: IMenuAction;
  hasPanel?: boolean;
  hasFocus: boolean;
  reservesChevron: boolean;
}) => (
  <>
    {action.icon !== undefined ? (
      <span className="nxm-dropdown-item-icon flex items-center justify-center">{action.icon}</span>
    ) : (
      !!action.iconPath && (
        <Icon className="nxm-dropdown-item-icon" path={action.iconPath} size="none" />
      )
    )}

    <span className="nxm-dropdown-item-label">{action.label}</span>

    {!!action.pin && <PopoverMenuItemPin hasFocus={hasFocus} pin={action.pin} />}

    {(hasPanel || reservesChevron) && (
      <Icon
        className={joinClasses("nxm-dropdown-item-icon", {
          "nxm-dropdown-item-chevron-hidden": !hasPanel,
        })}
        path={mdiChevronRight}
        size="none"
      />
    )}
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
            aria-haspopup={action.panelRole ?? "dialog"}
            className={joinClasses(["nxm-dropdown-item", dropdownItemBrandClass(action.brand)], {
              "nxm-dropdown-item-focus": hasFocus || open,
            })}
            aria-disabled={keepsPin || undefined}
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
            <PopoverMenuItemContent hasPanel reservesChevron action={action} hasFocus={hasFocus} />
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
  ({ action, hasFocus, reservesChevron, tabIndex, onTakeFocus, onSelect }, ref) => {
    const disabled = !!action.disabled || !!action.isLoading;
    // A disabled row with a pin stays reachable, so it can still be pinned: only its action is off.
    const keepsPin = disabled && !!action.pin;

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
        aria-disabled={keepsPin || undefined}
        disabled={disabled && !keepsPin}
        ref={ref}
        role="menuitem"
        tabIndex={tabIndex}
        type="button"
        onClick={() => {
          if (keepsPin) {
            return;
          }
          action.onClick?.();
          onSelect();
        }}
        onFocus={onTakeFocus}
        onMouseEnter={(event) => takeFocus(event.currentTarget)}
      >
        <PopoverMenuItemContent
          action={action}
          hasFocus={hasFocus}
          reservesChevron={reservesChevron}
        />
      </button>
    );
  },
);

PopoverMenuItem.displayName = "PopoverMenuItem";

import type { ReactNode } from "react";

import type { IButtonBrand } from "@/ui/components/button/Button";
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
  /** A button at the row's end, such as remove, that runs only itself and closes the menu. */
  control?: {
    /** The button's accessible name, and its tooltip. */
    label: string;
    /** Its icon, as an SVG path. */
    iconPath: string;
    /** What it does. */
    onClick: () => void;
  };
  /** Makes the row one of a choice, checked while it's the one chosen; others keep the room. */
  checked?: boolean;
}

/**
 * One activatable thing in a menu. Activating it either runs `onClick` or opens
 * `panel`; activation has a single meaning, so the two are mutually exclusive.
 */
export type IMenuAction = IMenuActionBase &
  XOr<{ onClick?: () => void }, { panel?: IPopoverPanel }>;

export interface IPopoverMenuItemProps {
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

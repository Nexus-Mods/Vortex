import type { IButtonBrand } from "@/ui/components/button/Button";

/**
 * What a menu row's brand adds to it, named the way `Button` names its own so an action
 * reads the same whichever it is rendered as. Absent when the row asks for no brand,
 * leaving it the colour the menu gives every other.
 *
 * Shared by the two components that render a `.nxm-dropdown-item`: `DropdownItem` and
 * the popover menu's own row. Which part of the row a brand colours is `dropdown.css`'s
 * to say — the icon for most of them, the whole row for `danger`.
 */
export const dropdownItemBrandClass = (brand?: IButtonBrand) =>
  !!brand && `nxm-dropdown-item-${brand}`;

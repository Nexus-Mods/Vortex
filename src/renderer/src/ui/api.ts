// The design-system components exposed to extensions as the `ui` namespace of
// `vortex-api`, e.g. `import { ui } from "vortex-api"; <ui.Button />`.
//
// Kept separate from the legacy controls in `controls/api.ts` because several
// names (Icon, Image, Modal, Dropdown, ContextMenu, ...) exist in both.
// Only add components here once they're stable: anything exported becomes part
// of the public extension API. The new Table is deliberately left out while it
// is still behind a dev switch.

// Actions
export {
  Button,
  type IButtonAppearance,
  type IButtonBrand,
  type IButtonColour,
  type IButtonProps,
} from "./components/button/Button";

// Text
export {
  getTypographyColourClass,
  getTypographyStyles,
  type ITypographyAppearance,
  type ITypographyBrand,
  type ITypographyColour,
  type ITypographyElements,
  type ITypographyProps,
  type ITypographyTypes,
  Typography,
} from "./components/typography/Typography";
export { type ITypographyLinkProps, TypographyLink } from "./components/typography/TypographyLink";
export { Html } from "./components/prose/html/Html";
export { Markdown } from "./components/prose/markdown/Markdown";
export { PlainText } from "./components/prose/plain_text/PlainText";
export type { IProseProps } from "./components/prose/Prose.types";

// Icons and imagery
export { Icon, type IIconSize } from "./components/icon/Icon";
export * as iconPaths from "./icon-paths";
export {
  type IPictogramBrand,
  type IPictogramName,
  Pictogram,
} from "./components/pictogram/Pictogram";
export { type IImageProps, Image } from "./components/image/Image";
export { AdultAwareImage, type IAdultAwareImageProps } from "./components/image/AdultAwareImage";
export { NexusBadge } from "./components/badges/nexus_badge/NexusBadge";
export { PremiumBadge } from "./components/badges/premium_badge/PremiumBadge";

// Status
export { Alert, type AlertSeverity, type IAlertProps } from "./components/alert/Alert";
export { type IPillAppearance, type IPillBrand, Pill } from "./components/pill/Pill";
export { Bullet, type IBulletProps } from "./components/bullet/Bullet";

// Overlays
export {
  type ITooltipDelay,
  type ITooltipPlacement,
  type ITooltipProps,
  Tooltip,
} from "./components/tooltip/Tooltip";
export { TitledTooltip } from "./components/tooltip/TitledTooltip";
export { TooltipDelayGroup } from "./components/tooltip/TooltipDelayGroup";
export { HoverCard } from "./components/hover_card/HoverCard";
export {
  ContextMenu,
  contextMenuPosition,
  type IContextMenuPosition,
  openedFromKeyboard,
} from "./components/context_menu/ContextMenu";
export { Modal, ModalPanel, ModalWrapper } from "./components/modal/Modal";

// Menus
export { Dropdown } from "./components/dropdown/Dropdown";
export { DropdownBlock } from "./components/dropdown/DropdownBlock";
export { DropdownButton, type IDropdownButtonProps } from "./components/dropdown/DropdownButton";
export { DropdownDivider } from "./components/dropdown/DropdownDivider";
export { DropdownItem } from "./components/dropdown/DropdownItem";
export { DropdownItems } from "./components/dropdown/DropdownItems";
export { Popover } from "./components/popover/Popover";
export { type IPopoverButtonProps, PopoverButton } from "./components/popover/PopoverButton";
export { PopoverPanel } from "./components/popover/PopoverPanel";
export { PopoverPanelGroup } from "./components/popover/PopoverPanelGroup";
export { PopoverPanelGroupItem } from "./components/popover/PopoverPanelGroupItem";
export { PopoverMenu } from "./components/popover/popover_menu/PopoverMenu";
export type {
  IMenuAction,
  IPopoverMenuItemProps,
  IPopoverPanel,
} from "./components/popover/popover_menu/PopoverMenu.types";

// Selection
export { Listbox } from "./components/listbox/Listbox";
export { type IListboxButtonProps, ListboxButton } from "./components/listbox/ListboxButton";
export { type IListboxOption, ListboxOption } from "./components/listbox/ListboxOption";
export { ListboxOptions } from "./components/listbox/ListboxOptions";
export { Picker } from "./components/picker/Picker";

// Tabs
export { TabBar } from "./components/tabs/TabBar";
export { type ITabButtonProps, TabButton } from "./components/tabs/TabButton";
export { TabPanel } from "./components/tabs/TabPanel";
export {
  type ITabProviderProps,
  type ITabsState,
  TabContext,
  TabProvider,
  useTabContext,
} from "./components/tabs/Tabs.context";

// Forms
export { CharacterCount } from "./components/form/field/CharacterCount";
export { Description, type IDescriptionProps } from "./components/form/field/Description";
export { ErrorMessage, type IErrorMessageProps } from "./components/form/field/ErrorMessage";
export { Field, type IFieldProps } from "./components/form/field/Field";
export { type ILabelProps, Label } from "./components/form/field/Label";
export { type IInputProps, Input } from "./components/form/input/Input";
export { Checkbox, type ICheckboxProps } from "./components/form/checkbox/Checkbox";
export { type ISelectProps, Select } from "./components/form/select/Select";
export { type ISwitchProps, Switch } from "./components/form/switch/Switch";
export {
  CheckboxField,
  type ICheckboxFieldProps,
} from "./components/form/checkbox_field/CheckboxField";
export { type ISelectFieldProps, SelectField } from "./components/form/select_field/SelectField";
export { type ISwitchFieldProps, SwitchField } from "./components/form/switch_field/SwitchField";
export { type ITextFieldProps, TextField } from "./components/form/text_field/TextField";

// Lists and empty states
export { Listing } from "./components/listing/Listing";
export { ListingLoader } from "./components/listing_loader/ListingLoader";
export { NoResults } from "./components/no_results/NoResults";
export { type IPaginationProps, Pagination } from "./components/pagination/Pagination";
export { JumpToPage } from "./components/pagination/JumpToPage";

// Tiles
export { GameTile, type IGameTileProps } from "./components/game_tile/GameTile";

// Toolbar
export { Toolbar } from "./components/toolbar/Toolbar";
export {
  type IToolbarAction,
  type IToolbarPanel,
  ToolbarGroup,
} from "./components/toolbar/ToolbarGroup";
export { type IToolbarButtonProps, ToolbarButton } from "./components/toolbar/ToolbarButton";
export {
  type IToolbarPanelButtonProps,
  type IToolbarPanelHandle,
  ToolbarPanelButton,
} from "./components/toolbar/ToolbarPanelButton";
export { ToolbarSearch } from "./components/toolbar/toolbar_search/ToolbarSearch";
export type {
  IToolbarActionIdentity,
  IToolbarAnalytics,
  IToolbarTrackingProperties,
  ToolbarPinTarget,
  ToolbarSurface,
} from "./components/toolbar/Toolbar.context";

// Utilities
export { joinClasses } from "./utils/joinClasses";
export type { ResponsiveScreenSizes, XOr } from "./utils/types";

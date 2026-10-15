import type { ISymbolSource } from "@/ui/components/icon/Icon";
import { nxmModOutline } from "@/ui/icon-paths";

/** The props an icon is given to a component by: a symbol, or an SVG path for one the font lacks. */
export interface IIconSourceProps {
  iconPath?: string;
  symbol?: ISymbolSource;
}

/**
 * The legacy icon names that actions and pages register with, and so extensions do, as the symbols
 * the new UI draws for them.
 */
const iconMap: Record<string, IIconSourceProps> = {
  dashboard: { symbol: "dashboard" },
  mods: { iconPath: nxmModOutline },
  settings: { symbol: "settings" },
  download: { symbol: "download" },
  game: { symbol: "stadia_controller" },
  health: { symbol: "cardiology" },
  support: { symbol: "help" },
  about: { symbol: "info" },
  menu: { symbol: "menu" },
  show: { symbol: "visibility" },
  feedback: { symbol: "comment" },
  nexus: { symbol: "language" },
  palette: { symbol: "palette" },
  plugins: { symbol: "power" },
  savegame: { symbol: "save" },
  tools: { symbol: "build" },
  tune: { symbol: "tune" },
  // icon names used by toolbar actions registered through `registerAction`
  browse: { symbol: "folder_managed" },
  categories: { symbol: "sell" },
  changelog: { symbol: "article" },
  delete: { symbol: "delete" },
  deploy: { symbol: "rocket_launch" },
  hide: { symbol: "visibility_off" },
  history: { symbol: "history" },
  import: { symbol: "input" },
  "open-ext": { symbol: "folder_open" },
  purge: { symbol: "cleaning_services" },
  refresh: { symbol: "refresh" },
  rules: { symbol: "rule" },
  swap: { symbol: "swap_horiz" },
  undo: { symbol: "undo" },
};

/** The icon for a legacy icon name, as the props to give a component, or a symbol of `fallbackSymbol`. */
export const getIconProps = (
  iconName: string,
  fallbackSymbol: ISymbolSource = "category",
): IIconSourceProps => iconMap[iconName] ?? { symbol: fallbackSymbol };

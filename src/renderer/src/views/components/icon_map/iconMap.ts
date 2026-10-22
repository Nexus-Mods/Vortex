import type { IIconSource } from "@/ui/components/icon/Icon";
import { nxmModOutline } from "@/ui/icon-paths";

/**
 * The legacy icon names that actions and pages register with, and so extensions do, as the icons
 * the new UI draws for them.
 */
const iconMap: Record<string, IIconSource> = {
  dashboard: "dashboard",
  mods: { path: nxmModOutline },
  settings: "settings",
  download: "download",
  game: "stadia_controller",
  health: "cardiology",
  support: "help",
  about: "info",
  menu: "menu",
  show: "visibility",
  feedback: "comment",
  nexus: "language",
  palette: "palette",
  plugins: "power",
  savegame: "save",
  tools: "build",
  tune: "tune",
  // icon names used by toolbar actions registered through `registerAction`
  browse: "folder_open",
  categories: "sell",
  changelog: "article",
  delete: "delete",
  deploy: "rocket_launch",
  hide: "visibility_off",
  history: "history",
  import: "input",
  "open-ext": "folder_open",
  purge: "cleaning_services",
  refresh: "refresh",
  rules: "rule",
  swap: "swap_horiz",
  undo: "undo",
};

/** The icon for a legacy icon name, or `fallbackIcon` for one with none. */
export const getIcon = (iconName: string, fallbackIcon: IIconSource = "category"): IIconSource =>
  iconMap[iconName] ?? fallbackIcon;

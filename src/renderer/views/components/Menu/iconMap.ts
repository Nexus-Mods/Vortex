import {
  mdiCog,
  mdiDownload,
  mdiGamepadSquare,
  mdiHelpCircle,
  mdiPuzzle,
  mdiShapeOutline,
  mdiViewDashboard,
} from "@mdi/js";

// Map legacy icon names to MDI paths
const iconMap: Record<string, string> = {
  dashboard: mdiViewDashboard,
  mods: mdiPuzzle,
  settings: mdiCog,
  download: mdiDownload,
  game: mdiGamepadSquare,
  support: mdiHelpCircle,
};

export const getIconPath = (iconName: string): string => {
  return iconMap[iconName] ?? mdiShapeOutline;
};

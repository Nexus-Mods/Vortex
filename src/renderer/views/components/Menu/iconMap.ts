import {
  mdiCog,
  mdiCommentTextOutline,
  mdiDownload,
  mdiEye,
  mdiGamepadSquare,
  mdiHelpCircle,
  mdiInformationOutline,
  mdiMenu,
  mdiPuzzle,
  mdiShapeOutline,
  mdiViewDashboard,
  mdiWeb,
} from "@mdi/js";

// Map legacy icon names to MDI paths
const iconMap: Record<string, string> = {
  dashboard: mdiViewDashboard,
  mods: mdiPuzzle,
  settings: mdiCog,
  download: mdiDownload,
  game: mdiGamepadSquare,
  support: mdiHelpCircle,
  about: mdiInformationOutline,
  menu: mdiMenu,
  show: mdiEye,
  feedback: mdiCommentTextOutline,
  nexus: mdiWeb,
};

export const getIconPath = (iconName: string): string => {
  return iconMap[iconName] ?? mdiShapeOutline;
};

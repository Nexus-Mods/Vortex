import {
  mdiCog,
  mdiCommentTextOutline,
  mdiContentSave,
  mdiDownload,
  mdiEye,
  mdiGamepadSquare,
  mdiPulse,
  mdiHelpCircle,
  mdiInformationOutline,
  mdiMenu,
  mdiPalette,
  mdiPowerPlug,
  mdiPuzzle,
  mdiShapeOutline,
  mdiTune,
  mdiViewDashboard,
  mdiWeb,
  mdiWrench,
} from "@mdi/js";

// Map legacy icon names to MDI paths
const iconMap: Record<string, string> = {
  dashboard: mdiViewDashboard,
  mods: mdiPuzzle,
  settings: mdiCog,
  download: mdiDownload,
  game: mdiGamepadSquare,
  health: mdiPulse,
  support: mdiHelpCircle,
  about: mdiInformationOutline,
  menu: mdiMenu,
  show: mdiEye,
  feedback: mdiCommentTextOutline,
  nexus: mdiWeb,
  palette: mdiPalette,
  plugins: mdiPowerPlug,
  savegame: mdiContentSave,
  tools: mdiWrench,
  tune: mdiTune,
};

export const getIconPath = (iconName: string, fallbackIcon: string = mdiShapeOutline): string => {
  return iconMap[iconName] ?? fallbackIcon;
};

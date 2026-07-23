import {
  mdiCogOutline,
  mdiCommentTextOutline,
  mdiContentSaveOutline,
  mdiDownload,
  mdiEyeOutline,
  mdiGamepadSquareOutline,
  mdiHelpCircleOutline,
  mdiInformationOutline,
  mdiMenu,
  mdiPaletteOutline,
  mdiPowerPlugOutline,
  mdiShapeOutline,
  mdiTune,
  mdiViewDashboardOutline,
  mdiWeb,
  mdiWrenchOutline,
} from "@mdi/js";

import { nxmHeartPulseOutline, nxmModOutline } from "@/ui/icon-paths";

// Map legacy icon names to MDI paths
const iconMap: Record<string, string> = {
  dashboard: mdiViewDashboardOutline,
  mods: nxmModOutline,
  settings: mdiCogOutline,
  download: mdiDownload,
  game: mdiGamepadSquareOutline,
  health: nxmHeartPulseOutline,
  support: mdiHelpCircleOutline,
  about: mdiInformationOutline,
  menu: mdiMenu,
  show: mdiEyeOutline,
  feedback: mdiCommentTextOutline,
  nexus: mdiWeb,
  palette: mdiPaletteOutline,
  plugins: mdiPowerPlugOutline,
  savegame: mdiContentSaveOutline,
  tools: mdiWrenchOutline,
  tune: mdiTune,
};

export const getIconPath = (iconName: string, fallbackIcon: string = mdiShapeOutline): string => {
  return iconMap[iconName] ?? fallbackIcon;
};

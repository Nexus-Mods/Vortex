import {
  mdiBroom,
  mdiCogOutline,
  mdiCommentTextOutline,
  mdiContentSaveOutline,
  mdiDownload,
  mdiEyeOutline,
  mdiFolderOpenOutline,
  mdiGamepadSquareOutline,
  mdiHelpCircleOutline,
  mdiHistory,
  mdiImport,
  mdiListStatus,
  mdiInformationOutline,
  mdiMenu,
  mdiPaletteOutline,
  mdiPowerPlugOutline,
  mdiRefresh,
  mdiRocketLaunchOutline,
  mdiShapeOutline,
  mdiSwapHorizontal,
  mdiTagMultipleOutline,
  mdiTextBoxOutline,
  mdiTune,
  mdiUndoVariant,
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
  // icon names used by toolbar actions registered through `registerAction`
  categories: mdiTagMultipleOutline,
  changelog: mdiTextBoxOutline,
  deploy: mdiRocketLaunchOutline,
  history: mdiHistory,
  import: mdiImport,
  "open-ext": mdiFolderOpenOutline,
  purge: mdiBroom,
  refresh: mdiRefresh,
  rules: mdiListStatus,
  swap: mdiSwapHorizontal,
  undo: mdiUndoVariant,
};

export const getIconPath = (iconName: string, fallbackIcon: string = mdiShapeOutline): string => {
  return iconMap[iconName] ?? fallbackIcon;
};

import {
  mdiCog,
  mdiCommentTextOutline,
  mdiContentSave,
  mdiDownload,
  mdiEye,
  mdiGamepadSquare,
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

// Material Symbols "heart-pulse" (outlined), transformed from the 0 -960 960 960
// viewBox to MDI's 0 0 24 24 space so it renders through the shared Icon component.
const heartPulseOutline =
  "M7.5 3q1.3 0 2.475 0.55t2.025 1.55q0.85 -1 2.025 -1.55t2.475 -0.55q2.35 0 3.925 1.575t1.575 3.925q0 0.125 -0.013 0.25t-0.013 0.25h-2q0.025 -0.125 0.025 -0.25v-0.25q0 -1.5 -1 -2.5t-2.5 -1q-1.175 0 -2.175 0.663T12.95 7.35h-1.9q-0.375 -1.025 -1.375 -1.688T7.5 5q-1.5 0 -2.5 1t-1 2.5v0.25q0 0.125 0.025 0.25H2.025q0 -0.125 -0.013 -0.25t-0.013 -0.25q0 -2.35 1.575 -3.925t3.925 -1.575Zm-2.2 12h2.8q0.8 0.775 1.75 1.675t2.15 1.975q1.2 -1.075 2.15 -1.975t1.75 -1.675h2.825q-0.95 1.05 -2.25 2.275T13.45 20.05l-1.45 1.3l-1.45 -1.3q-1.725 -1.55 -3.013 -2.775T5.3 15Zm5.75 1q0.325 0 0.562 -0.188T11.95 15.325l1.35 -4.075l0.875 1.3q0.125 0.2 0.35 0.325t0.475 0.125h8v-2H15.575l-1.725 -2.55q-0.15 -0.225 -0.388 -0.338T12.95 8q-0.325 0 -0.562 0.188T12.05 8.675l-1.35 4.05l-0.85 -1.275q-0.125 -0.2 -0.35 -0.325t-0.475 -0.125H1v2h7.425l1.725 2.55q0.15 0.225 0.388 0.338T11.05 16Zm0.95 -4.175Z";

// Map legacy icon names to MDI paths
const iconMap: Record<string, string> = {
  dashboard: mdiViewDashboard,
  mods: mdiPuzzle,
  settings: mdiCog,
  download: mdiDownload,
  game: mdiGamepadSquare,
  health: heartPulseOutline,
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

import * as reduxAct from "redux-act";

import safeCreateAction from "../../../actions/safeCreateAction";

export const setAutoDeployment = safeCreateAction(
  "SET_AUTO_DEPLOYMENT",
  (deploy: boolean) => deploy,
);
export const setAutoInstall = safeCreateAction("SET_AUTO_INSTALL", (enabled: boolean) => enabled);
export const setAutoEnable = safeCreateAction("SET_AUTO_ENABLE", (enabled: boolean) => enabled);
export const setAutoStart = safeCreateAction("SET_AUTO_START", (start: boolean) => start);
export const setStartMinimized = safeCreateAction(
  "SET_START_MINIMIZED",
  (minimized: boolean) => minimized,
);

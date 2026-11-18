import { actionsToReducerSpec } from "@/reducers/builder";
import type { ISettingsAutomation } from "@/types/IState";

import * as actions from "../actions/automation";

/**
 * reducer for changes to automation settings
 */
const automationReducer = actionsToReducerSpec<ISettingsAutomation, typeof actions>(
  {
    deploy: true,
    install: true,
    enable: true,
    start: false,
    minimized: false,
  },
  actions,
  {
    setAutoDeployment: (state, payload) => ({ ...state, deploy: payload }),
    setAutoInstall: (state, payload) => ({ ...state, install: payload }),
    setAutoEnable: (state, payload) => ({ ...state, enable: payload }),
    setAutoStart: (state, payload) => ({ ...state, start: payload }),
    setStartMinimized: (state, payload) => ({ ...state, minimized: payload }),
  },
);

export default automationReducer;

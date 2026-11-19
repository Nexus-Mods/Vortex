import { actionsToReducerSpec, setField } from "@/reducers/builder";
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
    setAutoDeployment: (state, payload) => setField(state, "deploy", payload),
    setAutoInstall: (state, payload) => setField(state, "install", payload),
    setAutoEnable: (state, payload) => setField(state, "enable", payload),
    setAutoStart: (state, payload) => setField(state, "start", payload),
    setStartMinimized: (state, payload) => setField(state, "minimized", payload),
  },
);

export default automationReducer;

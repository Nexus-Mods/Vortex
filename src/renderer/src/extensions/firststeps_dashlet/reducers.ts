import { actionsToReducerSpec } from "../../reducers/builder";
import * as actions from "./actions";

/** settings.firststeps: which "first steps" todos the user has dismissed */
export interface ISettingsFirstSteps {
  // nothing sets this; it is read by the dashlet and kept for persisted state
  dismissAll: boolean;
  // keyed by step id
  steps: { [stepId: string]: boolean };
}

declare module "@/types/IState" {
  interface ISettings {
    firststeps: ISettingsFirstSteps;
  }
}

/**
 * reducer for changes to first steps settings
 */
const settingsReducer = actionsToReducerSpec<ISettingsFirstSteps, typeof actions>(
  { dismissAll: false, steps: {} },
  actions,
  {
    dismissStep: (state, payload) => ({ ...state, steps: { ...state.steps, [payload]: true } }),
  },
);

export default settingsReducer;

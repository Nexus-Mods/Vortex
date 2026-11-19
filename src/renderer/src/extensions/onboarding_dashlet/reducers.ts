import { actionsToReducerSpec } from "@/reducers/builder";

import * as actions from "./actions";

/** settings.onboardingsteps: which onboarding steps the user has completed */
export interface ISettingsOnboardingSteps {
  // keyed by step id
  steps: { [stepId: string]: boolean };
}

declare module "@/types/IState" {
  interface ISettings {
    onboardingsteps: ISettingsOnboardingSteps;
  }
}

/**
 * reducer for changes to onboarding settings
 */
const settingsReducer = actionsToReducerSpec<ISettingsOnboardingSteps, typeof actions>(
  { steps: {} },
  actions,
  {
    completeStep: (state, payload) => ({ ...state, steps: { ...state.steps, [payload]: true } }),
    resetSteps: (state) => ({ ...state, steps: {} }),
  },
);

export default settingsReducer;

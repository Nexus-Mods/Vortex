import { actionsToPartialReducerSpec } from "@/reducers/builder";
import type { IDashletSettings, ISettingsInterface } from "@/types/IState";

import * as actions from "./actions";

function updateDashlet(
  state: ISettingsInterface,
  widgetId: string,
  changes: Partial<IDashletSettings>,
): ISettingsInterface {
  return {
    ...state,
    dashletSettings: {
      ...state.dashletSettings,
      [widgetId]: { ...state.dashletSettings?.[widgetId], ...changes },
    },
  };
}

/**
 * reducer for changes to interface settings
 *
 * settings.interface is shared with settings_interface and the starter dashlet; this reducer owns
 * only the dashboard layout and the per-dashlet settings.
 */
const settingsReducer = actionsToPartialReducerSpec<ISettingsInterface, typeof actions>(
  {
    dashboardLayout: [],
    dashletSettings: {},
  },
  actions,
  {
    setLayout: (state, payload) => ({ ...state, dashboardLayout: payload }),
    setDashletEnabled: (state, payload) => {
      let newState = updateDashlet(state, payload.widgetId, { enabled: payload.enabled });
      // When disabling, eagerly remove from layout so a re-enabled dashlet
      // appends to the end instead of reclaiming a position now occupied by
      // another dashlet.
      if (!payload.enabled) {
        const layout: string[] = newState.dashboardLayout ?? [];
        if (layout.includes(payload.widgetId)) {
          newState = {
            ...newState,
            dashboardLayout: layout.filter((id) => id !== payload.widgetId),
          };
        }
      }
      return newState;
    },
    setDashletWidth: (state, payload) =>
      updateDashlet(state, payload.widgetId, { width: payload.width }),
    setDashletHeight: (state, payload) =>
      updateDashlet(state, payload.widgetId, { height: payload.height }),
  },
);

export default settingsReducer;

import type { IReducerSpec } from "../../types/IExtensionContext";
import { setSafe } from "../../util/storeHelper";
import * as actions from "./actions";

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setLayout as any]: (state, payload) => setSafe(state, ["dashboardLayout"], payload),
    [actions.setDashletEnabled as any]: (state, payload) => {
      let newState = setSafe(
        state,
        ["dashletSettings", payload.widgetId, "enabled"],
        payload.enabled,
      );
      // When disabling, eagerly remove from layout so a re-enabled dashlet
      // appends to the end instead of reclaiming a position now occupied by
      // another dashlet.
      if (!payload.enabled) {
        const layout: string[] = newState.dashboardLayout ?? [];
        if (layout.includes(payload.widgetId)) {
          newState = setSafe(
            newState,
            ["dashboardLayout"],
            layout.filter((id) => id !== payload.widgetId),
          );
        }
      }
      return newState;
    },
    [actions.setDashletWidth as any]: (state, payload) =>
      setSafe(state, ["dashletSettings", payload.widgetId, "width"], payload.width),
    [actions.setDashletHeight as any]: (state, payload) =>
      setSafe(state, ["dashletSettings", payload.widgetId, "height"], payload.height),
  },
  defaults: {
    dashboardLayout: [],
    dashletSettings: {},
  },
};

export default settingsReducer;

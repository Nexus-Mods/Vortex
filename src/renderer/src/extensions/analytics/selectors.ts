import { getSafe } from "../../util/storeHelper";

export const isAnalyticsEnabled = (state: any): boolean =>
  getSafe(state, ["settings", "analytics", "enabled"], false);

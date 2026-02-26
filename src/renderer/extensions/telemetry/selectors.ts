import { getSafe } from "../../util/storeHelper";

export const isTelemetryEnabled = (state: any): boolean =>
  getSafe(state, ["settings", "analytics", "enabled"], false);

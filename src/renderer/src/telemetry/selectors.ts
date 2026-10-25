import { TELEMETRY_ENABLED } from "@vortex/shared";

import type { IState } from "../types/api";
import { getSafe } from "../util/storeHelper";

// mkeiitmods: TELEMETRY_ENABLED is off, so this is false whatever the setting says
export const isTelemetryEnabled = (state: IState): boolean =>
  TELEMETRY_ENABLED && getSafe(state, ["settings", "analytics", "enabled"], false);

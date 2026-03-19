import type { IState } from '../types/api';

import { getSafe } from "../util/storeHelper";

export const isTelemetryEnabled = (state: IState): boolean =>
  getSafe(state, ["settings", "analytics", "enabled"], false);

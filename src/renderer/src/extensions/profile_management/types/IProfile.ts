export interface IProfileMod {
  enabled: boolean;
  // MS timestamp of the last enable / last disable. Each is stamped on its own transition and
  // left untouched by the other, so a change can measure how long the mod spent in the prior
  // state (see mods_state_changed duration_ms). Persisted, so the span survives restarts.
  enabledTime: number;
  disabledTime?: number;
}

export interface IProfile {
  id: string;
  gameId: string;
  name: string;
  modState: { [id: string]: IProfileMod };
  lastActivated: number;
  pendingRemove?: boolean;
  features?: { [featureId: string]: any };
}

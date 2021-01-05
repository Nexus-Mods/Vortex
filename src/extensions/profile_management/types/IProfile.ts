export interface IProfileMod {
  enabled: boolean;
  enabledTime: number;
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

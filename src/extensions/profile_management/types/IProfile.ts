export interface IProfileMod {
  enabled: boolean;
  enabledTime: number;
}

export interface IProfile {
  id: string;
  gameId: string;
  name: string;
  lastActivated: number;
  modState?: { [id: string]: IProfileMod };
  pendingRemove?: boolean;
  features?: { [featureId: string]: any };
}

export interface IProfileMod {
  enabled: boolean;
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

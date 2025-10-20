export interface IProfile {
  id: string;
  name: string;
  gameId: string;
  lastActivated: number;
  modState: { [modId: string]: IProfileMod };
  features: { [featureId: string]: any };
}

export interface IProfileMod {
  enabled: boolean;
  enabledTime: number;
}
export interface IProfileMod {
  enabled: boolean;
}

export interface IProfile {
  id: string;
  gameId: string;
  name: string;
  modState: { [id: string]: IProfileMod };
  features?: { [featureId: string]: any };
}

export interface IProfileMod {
  enabled: boolean;
  order: number;
}

export interface IProfile {
  id: string;
  gameId: string;
  name: string;
  modState: { [id: string]: IProfileMod };
}

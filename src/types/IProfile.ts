interface IProfileMod {
  enabled: boolean;
  order: number;
}

export interface IProfile {
  id: string;
  name: string;
  modState: { [id: string]: IProfileMod };
}

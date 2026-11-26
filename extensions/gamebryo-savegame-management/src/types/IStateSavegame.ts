import { ISavegame } from "./ISavegame";

/** `session.saves` */
export interface IStateSavegame {
  saves: { [id: string]: ISavegame };
  savesTruncated: boolean;
  savegamePath: string;
  showDialog: boolean;
  selectedProfile: string | undefined;
}

/** `settings.saves` */
export interface ISettingsSavegame {
  monitorEnabled: boolean;
}

declare module "@nexusmods/vortex-api" {
  namespace types {
    interface ISessionState {
      saves: IStateSavegame;
    }
    interface ISettings {
      saves: ISettingsSavegame;
    }
  }
}

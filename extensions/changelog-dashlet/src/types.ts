export interface Changelog {
  version: string;
  text: string;
  prerelease: boolean;
}

export interface IChangelogsState {
  changelogs: Changelog[];
}

declare module "@nexusmods/vortex-api" {
  namespace types {
    interface IPersistentState {
      changelogs: IChangelogsState;
    }
  }
}

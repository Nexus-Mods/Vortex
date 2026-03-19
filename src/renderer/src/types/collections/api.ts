import type { IGameSpecificInterfaceProps } from "./IGameSpecificInterfaceProps";
import type * as types from "../api";

export interface ICollectionsGameSupportEntry {
  gameId: string;
  generator: (
    state: types.IState,
    gameId: string,
    stagingPath: string,
    modIds: string[],
    mods: { [modId: string]: types.IMod },
  ) => Promise<any>;

  parser: (
    api: types.IExtensionApi,
    gameId: string,
    collection: any,
  ) => Promise<void>;

  interface: (props: IGameSpecificInterfaceProps) => JSX.Element;
}

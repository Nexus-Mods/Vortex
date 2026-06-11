import type * as types from "../../../types/api";
import type { ICollection } from "./ICollection";
import type { IExtendedInterfaceProps } from "./IExtendedInterfaceProps";

export interface IGameSupportEntry {
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
    collection: ICollection,
    collectionMod: types.IMod,
  ) => Promise<void>;

  interface: (props: IExtendedInterfaceProps) => JSX.Element;
}

import type { IMod } from "../../../extensions/mod_management/types/IMod";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import type { ICollection } from "./ICollection";
import type { IExtendedInterfaceProps } from "./IExtendedInterfaceProps";

export interface IGameSupportEntry {
  generator: (
    state: IState,
    gameId: string,
    stagingPath: string,
    modIds: string[],
    mods: { [modId: string]: IMod },
  ) => Promise<any>;

  parser: (
    api: IExtensionApi,
    gameId: string,
    collection: ICollection,
    collectionMod: IMod,
  ) => Promise<void>;

  interface: (props: IExtendedInterfaceProps) => JSX.Element;
}

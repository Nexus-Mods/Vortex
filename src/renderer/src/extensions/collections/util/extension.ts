import type * as types from "../../../types/api";
import type { ICollection } from "../types/ICollection";
import type { IExtendedInterfaceProps } from "../types/IExtendedInterfaceProps";

export interface IExtensionFeature {
  id: string;
  generate: (gameId: string, includedMods: string[], mod: types.IMod) => Promise<any>;
  parse: (gameId: string, collection: ICollection, mod: types.IMod) => Promise<void>;
  clone: (
    gameId: string,
    collection: ICollection,
    from: types.IMod,
    to: types.IMod,
  ) => Promise<void>;
  title: (t: types.TFunction) => string;
  condition?: (state: types.IState, gameId: string) => boolean;
  editComponent?: React.ComponentType<IExtendedInterfaceProps>;
}

const features: IExtensionFeature[] = [];

export function addExtension(feature: IExtensionFeature) {
  features.push(feature);
}

export function findExtensions(state: types.IState, gameId: string): IExtensionFeature[] {
  return features.filter((iter) => iter.condition === undefined || iter.condition(state, gameId));
}

import type { IMod } from "../../../extensions/mod_management/types/IMod";
import type { IState } from "../../../types/IState";
import type { TFunction } from "../../../util/i18n";
import type { ICollection } from "../types/ICollection";
import type { IExtendedInterfaceProps } from "../types/IExtendedInterfaceProps";

export interface IExtensionFeature {
  id: string;
  generate: (gameId: string, includedMods: string[], mod: IMod) => Promise<any>;
  parse: (gameId: string, collection: ICollection, mod: IMod) => Promise<void>;
  clone: (gameId: string, collection: ICollection, from: IMod, to: IMod) => Promise<void>;
  title: (t: TFunction) => string;
  condition?: (state: IState, gameId: string) => boolean;
  editComponent?: React.ComponentType<IExtendedInterfaceProps>;
}

const features: IExtensionFeature[] = [];

export function addExtension(feature: IExtensionFeature) {
  features.push(feature);
}

export function findExtensions(state: IState, gameId: string): IExtensionFeature[] {
  return features.filter((iter) => iter.condition === undefined || iter.condition(state, gameId));
}

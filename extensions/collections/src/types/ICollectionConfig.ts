import { ICollection } from "./ICollection";
import { types } from "vortex-api";

export interface ICollectionConfig {
  recommendNewProfile: boolean;
}

export interface IConfigGeneratorProps {
  gameId: string;
  collectionMod: types.IMod;
}

export interface IConfigParserProps {
  gameId: string;
  collection: ICollection;
}

export interface IConfigSpecific {
  generateConfig: (
    genProps: IConfigGeneratorProps,
  ) => Promise<ICollectionConfig>;
  parseConfig: (parserProps: IConfigParserProps) => Promise<ICollectionConfig>;
}

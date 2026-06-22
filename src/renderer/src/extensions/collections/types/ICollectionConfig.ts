import type { IMod } from "../../../extensions/mod_management/types/IMod";
import type { ICollection } from "./ICollection";

export interface ICollectionConfig {
  recommendNewProfile: boolean;
  excludePluginRules: boolean;
}

export interface IConfigGeneratorProps {
  gameId: string;
  collectionMod: IMod;
}

export interface IConfigParserProps {
  gameId: string;
  collection: ICollection;
}

export interface IConfigSpecific {
  generateConfig: (genProps: IConfigGeneratorProps) => Promise<ICollectionConfig>;
  parseConfig: (parserProps: IConfigParserProps) => Promise<ICollectionConfig>;
}

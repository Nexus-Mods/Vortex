import type { IMod } from "../../../extensions/mod_management/types/IMod";
import type { ICollection } from "./ICollection";

export interface ICollectionConfig {
  recommendNewProfile: boolean;
  excludePluginRules: boolean;
  // Identifies how this collection's member referenceTags were generated. Deterministic tags can
  // only be applied to collections authored AFTER that change (already-published collections keep
  // their random shortid tags and can never be retrofitted), so the scheme must be recorded in the
  // config NOW to tell the two apart at install time:
  //   absent          -> legacy: random shortid tags, matched only by the stamped tag.
  //   "deterministic" -> tags derived from file identity + installSpec (deterministicReferenceTag),
  //                      stable across re-install/restart and recomputable/indexable by the matcher.
  // Set ONLY by the authoring path (alongside actually generating deterministic tags); the config
  // defaults must leave it absent so legacy collections that fall back to the defaults are not
  // mislabelled.
  referenceTagScheme?: "deterministic";
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

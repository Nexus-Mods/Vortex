import type { IMod } from "../../../extensions/mod_management/types/IMod";
import type { ICollection } from "./ICollection";

export interface ICollectionConfig {
  recommendNewProfile: boolean;
  excludePluginRules: boolean;
  // Identifies how this collection's member referenceTags were generated, so the install side knows
  // how to match them:
  //   absent -> random shortid tags, matched only by the stamped tag.
  //   a version string (REFERENCE_TAG_SCHEME) -> tags derived from file identity + installSpec
  //     (deterministicReferenceTag), stable across re-install/restart and recomputable by the matcher.
  // Set only by the authoring path; the config defaults leave it absent.
  referenceTagScheme?: string;
}

export interface IConfigGeneratorProps {
  gameId: string;
  collectionMod: IMod;
}

export interface IConfigParserProps {
  gameId: string;
  collection: ICollection;
}

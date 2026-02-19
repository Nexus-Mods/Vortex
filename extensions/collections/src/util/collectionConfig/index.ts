import {
  ICollectionConfig,
  IConfigGeneratorProps,
  IConfigParserProps,
} from "../../types/ICollectionConfig";
import { util } from "vortex-api";

const configDefaults: ICollectionConfig = {
  recommendNewProfile: false,
};

export async function generateConfig(
  props: IConfigGeneratorProps,
): Promise<ICollectionConfig> {
  const { collectionMod } = props;
  const config: ICollectionConfig = util.getSafe(
    collectionMod,
    ["attributes", "collection", "collectionConfig"],
    configDefaults,
  );
  return {
    ...config,
  };
}

export async function parseConfig(
  props: IConfigParserProps,
): Promise<ICollectionConfig> {
  const { collection } = props;
  const config: ICollectionConfig = util.getSafe(
    collection,
    ["collectionConfig"],
    configDefaults,
  );
  return config;
}

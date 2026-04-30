import {
  ICollectionConfig,
  IConfigGeneratorProps,
  IConfigParserProps,
} from "../../types/ICollectionConfig";

const configDefaults: ICollectionConfig = {
  recommendNewProfile: false,
  excludePluginRules: false,
};

export async function generateConfig(
  props: IConfigGeneratorProps,
): Promise<ICollectionConfig> {
  const { collectionMod } = props;
  const config: ICollectionConfig =
    collectionMod?.attributes?.collection?.collectionConfig ?? configDefaults;
  return {
    ...config,
  };
}

export async function parseConfig(
  props: IConfigParserProps,
): Promise<ICollectionConfig> {
  const { collection } = props;
  return collection?.collectionConfig ?? configDefaults;
}

import type { ICollectionManifest } from "@nexusmods/nexus-api";
import type { components } from "@vortex/nexus-api-v3";

type V3CollectionPayload = components["schemas"]["CollectionPayload"];
type V3CollectionManifest = components["schemas"]["CollectionManifest"];
type V3CollectionManifestMod = components["schemas"]["CollectionManifestMod"];
type V3CollectionManifestModSource =
  components["schemas"]["CollectionManifestModSource"];

function toV3ManifestModSource(
  source: ICollectionManifest["mods"][number]["source"],
): V3CollectionManifestModSource {
  return {
    type: source.type satisfies V3CollectionManifestModSource["type"],
    mod_id: source.modId?.toString() ?? null,
    file_id: source.fileId?.toString() ?? null,
    md5: source.md5 ?? null,
    file_size: source.fileSize ?? null,
    update_policy:
      source.updatePolicy satisfies V3CollectionManifestModSource["update_policy"],
    logical_filename: source.logicalFilename ?? null,
    file_expression: source.fileExpression ?? null,
    url: source.url ?? null,
    adult_content: source.adultContent ?? null,
  };
}

function toV3ManifestMod(
  mod: ICollectionManifest["mods"][number],
): V3CollectionManifestMod {
  return {
    name: mod.name,
    version: mod.version,
    optional: mod.optional,
    domain_name: mod.domainName,
    source: toV3ManifestModSource(mod.source),
    author: mod.author ?? null,
  };
}

function emptyToNull(value: string | undefined | null): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return value;
}

function toV3Manifest(manifest: ICollectionManifest): V3CollectionManifest {
  return {
    info: {
      author: manifest.info.author,
      author_url: emptyToNull(manifest.info.authorUrl),
      name: manifest.info.name,
      description: emptyToNull(manifest.info.description),
      summary: emptyToNull(manifest.info.summary),
      domain_name: manifest.info.domainName,
      game_versions: manifest.info.gameVersions ?? null,
    },
    mods: manifest.mods.map(toV3ManifestMod),
  };
}

export function toV3CollectionPayload(
  manifest: ICollectionManifest,
  adultContent: boolean = false,
): V3CollectionPayload {
  return {
    adult_content: adultContent,
    collection_manifest: toV3Manifest(manifest),
    collection_schema_id: 1,
  };
}

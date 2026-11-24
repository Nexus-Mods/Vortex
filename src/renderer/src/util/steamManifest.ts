import { parse as parseKV, type KVBlock } from "@nexusmods/steam-kv-parser";
import { z } from "zod";

// Steam appmanifest_<appid>.acf parsing. Kept apart from the Steam store class, whose
// module builds its singleton on import, so readers of manifests don't load the store.

export interface ISteamManifestDepot {
  depotId: number;
  manifestId: string;
  dlcAppId: string | null;
}

export interface ISteamManifestSharedDepot {
  depotId: number;
  ownerAppId: number;
}

/** Install-relevant appmanifest fields, extracted from a steam-kv-parser tree and
    zod-validated. Depot arrays keep file order, mount order to the store. */
export interface ISteamInstallData {
  appId: number;
  buildId: number;
  stateFlags: number;
  targetBuildId: number;
  branch: string | null;
  language: string;
  mountedLanguage: string;
  depots: ISteamManifestDepot[];
  sharedDepots: ISteamManifestSharedDepot[];
}

export const manifestLeaf = (block: KVBlock, key: string): string | undefined => {
  const leaf = block.children.find((child) => child.type === "leaf" && child.key === key);
  return leaf?.type === "leaf" ? leaf.value : undefined;
};

const manifestBlock = (block: KVBlock, key: string): KVBlock | undefined => {
  const child = block.children.find((child) => child.type === "block" && child.key === key);
  return child?.type === "block" ? child : undefined;
};

const MANIFEST_INSTALL_SCHEMA = z.object({
  appId: z.coerce.number(),
  buildId: z.coerce.number(),
  stateFlags: z.coerce.number(),
  targetBuildId: z.coerce.number().catch(0),
  // current clients write "public" for the default branch, older ones leave it empty or omit it
  branch: z
    .union([z.string(), z.null()])
    .transform((value) =>
      value === null || value === "" || value.toLowerCase() === "public" ? null : value,
    ),
  language: z.string(),
  mountedLanguage: z.string(),
  depots: z.array(
    z.object({
      depotId: z.coerce.number(),
      manifestId: z.string(),
      dlcAppId: z.string().nullable(),
    }),
  ),
  sharedDepots: z.array(
    z.object({
      depotId: z.coerce.number(),
      ownerAppId: z.coerce.number(),
    }),
  ),
});

/** The install-relevant appmanifest fields, undefined when the manifest lacks
    the fields that identify an install. The steam-kv-parser tree keeps every
    child in file order, so the depots it walks keep their mount order - which
    simple-vdf (still parsing libraryfolders.vdf) would lose on depot keys. */
export function collectInstallData(appState: KVBlock): ISteamInstallData | undefined {
  const userConfig = manifestBlock(appState, "UserConfig");
  const mountedConfig = manifestBlock(appState, "MountedConfig");

  const depots: Array<{ depotId: string; manifestId: string; dlcAppId: string | null }> = [];
  const depotsBlock = manifestBlock(appState, "InstalledDepots");
  if (depotsBlock !== undefined) {
    for (const depot of depotsBlock.children) {
      if (depot.type === "block") {
        const manifestId = manifestLeaf(depot, "manifest");
        // a manifest id is the depot's identity; pair/dashboard depots lack one
        if (manifestId === undefined || manifestId === "") continue;
        depots.push({
          depotId: depot.key,
          manifestId,
          dlcAppId: manifestLeaf(depot, "dlcappid") ?? null,
        });
      } else if (depot.type === "leaf" && depot.value !== "") {
        // older manifests map the depot key straight onto its manifest id
        depots.push({ depotId: depot.key, manifestId: depot.value, dlcAppId: null });
      }
    }
  }

  const sharedDepots: Array<{ depotId: string; ownerAppId: string }> = [];
  const sharedBlock = manifestBlock(appState, "SharedDepots");
  if (sharedBlock !== undefined) {
    for (const depot of sharedBlock.children) {
      if (depot.type === "leaf") {
        sharedDepots.push({ depotId: depot.key, ownerAppId: depot.value });
      }
    }
  }

  const installFields = {
    appId: manifestLeaf(appState, "appid"),
    buildId: manifestLeaf(appState, "buildid"),
    stateFlags: manifestLeaf(appState, "StateFlags"),
    targetBuildId: manifestLeaf(appState, "TargetBuildID") ?? "0",
    branch: (userConfig === undefined ? undefined : manifestLeaf(userConfig, "BetaKey")) ?? null,
    language: (userConfig === undefined ? undefined : manifestLeaf(userConfig, "language")) ?? "",
    mountedLanguage:
      (mountedConfig === undefined ? undefined : manifestLeaf(mountedConfig, "language")) ?? "",
    depots,
    sharedDepots,
  };

  const installData = MANIFEST_INSTALL_SCHEMA.safeParse(installFields);
  if (!installData.success) {
    return undefined;
  }
  // the schema output type leaves optional/nullish fields loose; complete to the entry type
  return {
    appId: installData.data.appId,
    buildId: installData.data.buildId,
    stateFlags: installData.data.stateFlags,
    targetBuildId: installData.data.targetBuildId ?? 0,
    branch: installData.data.branch ?? null,
    language: installData.data.language,
    mountedLanguage: installData.data.mountedLanguage,
    depots: installData.data.depots.map((depot) => ({
      depotId: depot.depotId,
      manifestId: depot.manifestId,
      dlcAppId: depot.dlcAppId ?? null,
    })),
    sharedDepots: installData.data.sharedDepots,
  };
}

/** The install-relevant fields of an appmanifest_<appid>.acf's text; undefined when
    it doesn't parse or lacks them. */
export function installDataFromManifest(manifestText: string): ISteamInstallData | undefined {
  try {
    const appState = parseKV(manifestText);
    return appState.key === "AppState" ? collectInstallData(appState) : undefined;
  } catch {
    return undefined;
  }
}

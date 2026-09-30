import * as path from "path";

export interface IDiscoveryPath {
  path?: string;
  store?: string;
}

export interface IProtonStoreEntry {
  usesProton?: boolean;
  compatDataPath?: string;
}

export type FindByPath = (gamePath: string, storeId?: string) => PromiseLike<IProtonStoreEntry>;

export async function resolveDocumentsPath(
  discovery: IDiscoveryPath,
  hostDocumentsPath: string,
  findByPath: FindByPath,
  platform: NodeJS.Platform = process.platform,
): Promise<string> {
  if (platform !== "linux" || discovery?.store !== "steam" || discovery.path === undefined) {
    return hostDocumentsPath;
  }

  try {
    const entry = await findByPath(discovery.path, "steam");
    if (entry.usesProton && entry.compatDataPath !== undefined) {
      return path.join(entry.compatDataPath, "pfx", "drive_c", "users", "steamuser", "Documents");
    }
  } catch {
    // Fall back to the native Documents directory.
  }

  return hostDocumentsPath;
}

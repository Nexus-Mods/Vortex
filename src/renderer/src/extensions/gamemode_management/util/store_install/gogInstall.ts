import { getErrorMessageOrDefault } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";

import { log } from "@/logging";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";
import { gogGameProductId } from "@/util/GOGLauncher";

import { cachedFileParser, type ParsedFile } from "./cachedFileParser";
import type { InstallRecord } from "./storeInstall";

/** What a goggame-<productId>.info says about the install. */
interface GogInfo {
  /** The game the file belongs to: itself for a game, the game for a DLC. */
  rootGameId: string | undefined;
  /** Undefined when the file names no build. */
  buildId: string | undefined;
  language: string;
}

/**
 * The fields of a goggame-<productId>.info's raw content. They are regexed off the raw
 * text rather than passed through JSON.parse because build ids exceed 2^53 and would be
 * corrupted as JS numbers (per the contract notes).
 */
export function parseGogInfo(raw: string): GogInfo {
  return {
    rootGameId: /"rootGameId"\s*:\s*"?(\d+)"?/.exec(raw)?.[1],
    buildId: /"buildId"\s*:\s*"?(\d+)"?/.exec(raw)?.[1],
    // GOG writes the requested languages as a list of locale tags ("languages"); some
    // installers instead carry a scalar "language". Prefer the tag list.
    language:
      /"languages"\s*:\s*\[\s*"([^"]+)"/.exec(raw)?.[1] ??
      /"language"\s*:\s*"([^"]+)"/.exec(raw)?.[1] ??
      "",
  };
}

const readInfo = cachedFileParser(parseGogInfo);

/** The goggame-<productId>.info in the game folder. */
function readGogInfo(gamePath: string, productId: string): Promise<ParsedFile<GogInfo>> {
  return readInfo(QualifiedPath.fromNative(gamePath).join(`goggame-${productId}.info`));
}

/** Per folder the registry doesn't list, the product id its .info files name (undefined
    for none): listed once per session, and again when that .info disappears. */
const folderProductIds = new Map<string, string | undefined>();

/** The product id of a goggame-<productId>.info in the folder, for a game the registry
    doesn't list: Galaxy was uninstalled, or Windows reset, and the game kept working
    without it. Undefined when the folder has none. */
async function gogInfoProductIdIn(folder: string): Promise<string | undefined> {
  if (folderProductIds.has(folder)) {
    return folderProductIds.get(folder);
  }
  try {
    const files = await window.api.fs.enumerateDirectory(QualifiedPath.fromNative(folder), {
      types: "files",
      include: "*/goggame-*.info",
    });
    for await (const file of files) {
      const productId = /^goggame-(\d+)\.info$/i.exec(file.basename)?.[1];
      if (productId !== undefined) {
        folderProductIds.set(folder, productId);
        return productId;
      }
    }
    folderProductIds.set(folder, undefined);
  } catch (err) {
    log("debug", "store-game-version: gog folder unreadable", {
      folder,
      error: getErrorMessageOrDefault(err),
    });
  }
  return undefined;
}

/** The GOG install in the game's folder, from the registry entries there (`atPath`).
    Each DLC has its own entry there too, so the game's install is reported: named by
    the registry and, where the registry doesn't say, by the DLC's .info. */
export async function scanGogInstall(
  folder: string,
  atPath: IGameStoreEntry[],
): Promise<InstallRecord> {
  const entry = atPath[0];
  const startId = entry !== undefined ? gogGameProductId(entry) : await gogInfoProductIdIn(folder);
  if (startId === undefined) {
    return { storeId: "gog", install: null, failureReason: "store-entry-not-found" };
  }

  let productId = startId;
  let read = await readGogInfo(folder, productId);
  if (entry === undefined && read.status === "missing") {
    // the .info the folder named is gone: list the folder again next time
    folderProductIds.delete(folder);
  }
  const rootGameId = read.status === "parsed" ? read.value.rootGameId : undefined;
  if (rootGameId !== undefined && rootGameId !== productId) {
    productId = rootGameId;
    read = await readGogInfo(folder, productId);
  }
  if (read.status === "missing") {
    return { storeId: "gog", install: null, failureReason: "info-missing" };
  }
  if (read.status === "unreadable") {
    return { storeId: "gog", install: null, failureReason: "info-unreadable" };
  }
  const info = read.value;
  if (info.buildId === undefined) {
    return { storeId: "gog", install: null, failureReason: "info-no-build-id" };
  }
  return {
    storeId: "gog",
    install: { product_id: productId, build_id: info.buildId, install_language: info.language },
    failureReason: null,
  };
}

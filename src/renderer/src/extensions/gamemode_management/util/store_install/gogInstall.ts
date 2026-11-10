import type { GogInstall } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";

import { log } from "@/logging";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";
import { gogGameProductId } from "@/util/GOGLauncher";

import type { InstallRecord } from "./storeInstall";

/**
 * The gog install block from the raw goggame-<productId>.info content. The fields
 * are regexed off the raw text rather than passed through JSON.parse because build
 * ids exceed 2^53 and would be corrupted as JS numbers (per the contract notes).
 */
export function gogInstallFromInfo(raw: string, productId: string): GogInstall | null {
  const buildId = /"buildId"\s*:\s*"?(\d+)"?/.exec(raw)?.[1];
  if (buildId === undefined) return null;

  // GOG writes the requested languages as a list of locale tags ("languages"); some
  // installers instead carry a scalar "language". Prefer the tag list.
  const language =
    /"languages"\s*:\s*\[\s*"([^"]+)"/.exec(raw)?.[1] ??
    /"language"\s*:\s*"([^"]+)"/.exec(raw)?.[1];

  return { product_id: productId, build_id: buildId, install_language: language ?? "" };
}

/** The game a goggame-<productId>.info belongs to: itself for a game, the game for a DLC. */
function gogRootGameId(raw: string): string | undefined {
  return /"rootGameId"\s*:\s*"?(\d+)"?/.exec(raw)?.[1];
}

/** The raw goggame-<productId>.info in the game folder; undefined when unreadable. */
async function readGogInfo(gamePath: string, productId: string): Promise<string | undefined> {
  try {
    const blob = await window.api.fs.readFile(
      QualifiedPath.fromNative(gamePath).join(`goggame-${productId}.info`),
    );
    return new TextDecoder().decode(blob);
  } catch (err) {
    // a missing file just means Galaxy never wrote metadata for this install
    log("debug", "store-game-version: gog info file unreadable", {
      gamePath,
      error: getErrorMessageOrDefault(err),
    });
    return undefined;
  }
}

/** The product id of a goggame-<productId>.info in the folder, for a game the registry
    doesn't list: Galaxy was uninstalled, or Windows reset, and the game kept working
    without it. Undefined when the folder has none. */
async function gogInfoProductIdIn(folder: string): Promise<string | undefined> {
  try {
    const files = await window.api.fs.enumerateDirectory(QualifiedPath.fromNative(folder), {
      types: "files",
      include: "*/goggame-*.info",
    });
    for await (const file of files) {
      const productId = /^goggame-(\d+)\.info$/i.exec(file.basename)?.[1];
      if (productId !== undefined) {
        return productId;
      }
    }
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
  let raw = await readGogInfo(folder, productId);
  const rootGameId = raw === undefined ? undefined : gogRootGameId(raw);
  if (rootGameId !== undefined && rootGameId !== productId) {
    productId = rootGameId;
    raw = await readGogInfo(folder, productId);
  }
  if (raw === undefined) {
    return { storeId: "gog", install: null, failureReason: "info-missing" };
  }
  const info = gogInstallFromInfo(raw, productId);
  if (info === null) {
    return { storeId: "gog", install: null, failureReason: "info-no-build-id" };
  }
  return { storeId: "gog", install: info, failureReason: null };
}

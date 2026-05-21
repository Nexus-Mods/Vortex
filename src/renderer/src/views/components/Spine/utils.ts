import { readFileSync } from "fs";
import * as path from "path";
import * as url from "url";

import { getErrorCode } from "@vortex/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import type { IDiscoveryResult } from "../../../extensions/gamemode_management/types/IDiscoveryResult";
import type { IGameStored } from "../../../extensions/gamemode_management/types/IGameStored";
import { nexusGames } from "../../../extensions/nexus_integration/util";
import { nexusGameId } from "../../../extensions/nexus_integration/util/convertGameId";
import { log } from "../../../logging";
import { ensureDirWritableAsync, writeFileAsync } from "../../../util/fs";
import getVortexPath from "../../../util/getVortexPath";

// ---------------------------------------------------------------------------
// Display formatting
// ---------------------------------------------------------------------------

/**
 * Some game extensions embed a tab in their `name` (e.g. `'Fallout:\tNew Vegas'`)
 * as a separator after the colon. DOM text rendering collapses this to a single
 * space, but HTML `title=` tooltips render whitespace literally, producing a
 * visible gap. Normalize for display.
 */
export const formatGameDisplayName = (name: string): string => name.replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// Image cache — persisted to disk, keyed by game ID
// ---------------------------------------------------------------------------

const IMAGE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

interface CacheEntry {
  url: string;
  cachedAt: number;
}

const imageCache = new Map<string, CacheEntry>();
let diskCacheLoaded = false;

const ICON_CACHE_DIR = "icon_cache";

const iconCacheDir = (): string => path.join(getVortexPath("userData"), ICON_CACHE_DIR);

const imageCachePath = (): string => path.join(iconCacheDir(), "game_image_cache.json");

const ensureDiskCacheLoaded = (): void => {
  if (diskCacheLoaded) return;
  diskCacheLoaded = true;
  try {
    const raw = readFileSync(imageCachePath(), "utf8");
    const entries = JSON.parse(raw) as Record<string, CacheEntry>;
    for (const [key, entry] of Object.entries(entries)) {
      imageCache.set(key, entry);
    }
  } catch {
    // File missing or corrupt — start fresh.
  }
};

let saveTimer: ReturnType<typeof setTimeout> | undefined;

const persistCache = (): void => {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const obj: Record<string, CacheEntry> = {};
    for (const [key, entry] of imageCache.entries()) {
      obj[key] = entry;
    }
    ensureDirWritableAsync(iconCacheDir())
      .then(() => writeFileAsync(imageCachePath(), JSON.stringify(obj)))
      .catch((err) => {
        log("warn", "Failed to persist game image cache", err);
      });
  }, 1000);
};

const setCacheEntry = (key: string, resolvedUrl: string): void => {
  imageCache.set(key, { url: resolvedUrl, cachedAt: Date.now() });
  persistCache();
};

const cachedImagePath = (gameId: string, ext: string = ".jpg"): string =>
  path.join(iconCacheDir(), `${gameId}${ext}`);

/** Download a remote image and save it to the icon cache directory. */
const downloadImage = async (imageUrl: string, gameId: string): Promise<string> => {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const ext = path.extname(new URL(imageUrl).pathname) || ".jpg";
  const buffer = Buffer.from(await response.arrayBuffer());
  const filePath = cachedImagePath(gameId, ext);
  await ensureDirWritableAsync(iconCacheDir());
  try {
    await writeFileAsync(filePath, buffer, { flag: "wx" });
  } catch (err) {
    if (getErrorCode(err) !== "EEXIST") {
      throw err;
    }
  }
  return url.pathToFileURL(filePath).href;
};

// ---------------------------------------------------------------------------
// URL resolution
// ---------------------------------------------------------------------------

const getNexusNumericId = (game: IGameStored): number | undefined => {
  const domainName = nexusGameId(game);
  return nexusGames().find((g) => g.domain_name === domainName)?.id;
};

export interface GameImageUrls {
  cacheKey: string;
  /** All sources in priority order: local logo, imageURL, remote thumbnail. */
  sources: string[];
  /** The remote thumbnail URL — also background-probed for upgrade. */
  preferred: string | undefined;
}

export const getGameImageUrls = (
  game: IGameStored,
  discovery: IDiscoveryResult | undefined,
): GameImageUrls => {
  const sources: string[] = [];
  let preferred: string | undefined;

  // 1. Local logo (fast)
  const logo = discovery?.logo ?? game.logo;
  const extensionPath = discovery?.extensionPath ?? game.extensionPath;
  if (extensionPath !== undefined && logo !== undefined) {
    sources.push(url.pathToFileURL(path.join(extensionPath, logo)).href);
  }

  // 2. Remote imageURL from game metadata
  if (game.imageURL !== undefined) {
    sources.push(game.imageURL);
  }

  // 3. Nexus thumbnail (also background-probed)
  const numericId = getNexusNumericId(game);
  if (numericId !== undefined) {
    preferred = `https://images.nexusmods.com/images/games/v2/${numericId}/thumbnail.jpg`;
    sources.push(preferred);
  }

  return { cacheKey: game.id, sources, preferred };
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Resolves the best image for a game: serves the cached URL when fresh,
 * otherwise shows local sources first and background-probes the preferred
 * (remote) URL for an upgrade. Results are persisted to disk.
 */
export const useGameImage = (
  cacheKey: string,
  sources: string[],
  preferred: string | undefined,
) => {
  ensureDiskCacheLoaded();

  const cached = imageCache.get(cacheKey);
  const isFresh = cached !== undefined && Date.now() - cached.cachedAt < IMAGE_TTL_MS;

  const [src, setSrc] = useState(() => (isFresh ? cached.url : (sources[0] ?? "")));
  const [exhausted, setExhausted] = useState(false);
  // Next fallback index for onError: 0 when showing a cached URL (sources untried),
  // 1 when already showing sources[0].
  const idx = useRef(isFresh ? 0 : 1);
  const prevKey = useRef(cacheKey);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  // Reset when the game changes.
  if (prevKey.current !== cacheKey) {
    prevKey.current = cacheKey;
    const entry = imageCache.get(cacheKey);
    const valid = entry !== undefined && Date.now() - entry.cachedAt < IMAGE_TTL_MS;
    setSrc(valid ? entry.url : (sources[0] ?? ""));
    idx.current = valid ? 0 : 1;
    setExhausted(false);
  }

  // Background: download the preferred (remote) image to disk and upgrade.
  useEffect(() => {
    if (preferred === undefined) return;
    const entry = imageCache.get(cacheKey);
    if (entry !== undefined && Date.now() - entry.cachedAt < IMAGE_TTL_MS) {
      return;
    }

    let cancelled = false;
    downloadImage(preferred, cacheKey)
      .then((fileUrl) => {
        if (cancelled) return;
        setCacheEntry(cacheKey, fileUrl);
        setSrc(fileUrl);
      })
      .catch((err) => {
        log("debug", "Failed to download game image", { cacheKey, error: err });
        // Remote unavailable — refresh TTL on stale entries.
        if (!cancelled && entry !== undefined && Date.now() - entry.cachedAt >= IMAGE_TTL_MS) {
          setCacheEntry(cacheKey, entry.url);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, preferred]);

  const onError = useCallback(() => {
    if (idx.current < sourcesRef.current.length) {
      setSrc(sourcesRef.current[idx.current]);
      idx.current += 1;
    } else {
      setExhausted(true);
    }
  }, []);

  const onLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const loadedSrc = e.currentTarget.src;
      if (!loadedSrc.startsWith("file:")) {
        setCacheEntry(cacheKey, loadedSrc);
      }
    },
    [cacheKey],
  );

  return { src, exhausted, onError, onLoad };
};

import { access } from "node:fs/promises";
import * as path from "path";

import type { IDownload } from "../types/IDownload";

// Placeholder filename a download uses on disk while in progress, renamed to the
// real name on completion. The UI shows friendlyDownloadName in its place.
export const TEMP_DOWNLOAD_PREFIX = "__vortex_tmp_";

export function isTempDownloadName(name: string | undefined): boolean {
  return name !== undefined && name.startsWith(TEMP_DOWNLOAD_PREFIX);
}

/** File name from a URL's basename, best-effort; undefined if missing/unparseable. */
export function nameFromUrl(input: string | undefined): string | undefined {
  if (input === undefined) {
    return undefined;
  }

  try {
    const pathname = new URL(input).pathname;
    return decodeURI(path.basename(pathname));
  } catch {
    return undefined;
  }
}

/**
 * Name to show for a download. Prefers the real on-disk name; while the temp
 * placeholder is still in use, falls back to metadata or the URL so the user
 * doesn't see __vortex_tmp_*.
 */
export function friendlyDownloadName(download: IDownload): string | undefined {
  const localPath = download.localPath;
  if (localPath && !isTempDownloadName(localPath)) {
    return localPath;
  }

  const candidates: Array<string | undefined> = [
    download.modInfo?.name,
    download.modInfo?.meta?.logicalFileName,
    download.modInfo?.meta?.fileName,
    download.modInfo?.nexus?.fileInfo?.name,
    nameFromUrl(download.urls?.[0]),
  ];
  const friendly = candidates.find(Boolean);

  // Fall back to the temp name so sort/filter stay stable before metadata resolves.
  return friendly ?? localPath;
}

/**
 * Returns fileName if it is free in dlPath, otherwise a timestamped variant ("name.<ms>.ext"), so an
 * existing download is never overwritten.
 */
export async function freeDownloadName(dlPath: string, fileName: string): Promise<string> {
  const taken = await access(path.join(dlPath, fileName)).then(
    () => true,
    () => false,
  );
  if (!taken) {
    return fileName;
  }
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  return `${base}.${Date.now()}${ext}`;
}

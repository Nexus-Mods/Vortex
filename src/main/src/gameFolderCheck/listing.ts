/** What is in the game folder: every file from one walk, plus what Vortex's deployment manifests list. */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getErrorMessageOrDefault } from "@vortex/shared";
import turbowalk from "turbowalk";

import { log } from "../logging";
import { pathKey } from "./baseline";

export interface IDiskFile {
  relPath: string;
  size: number;
  mtimeMs: number;
}

export interface IListing {
  /** Keyed by `pathKey` */
  files: Map<string, IDiskFile>;
  /** Deployed files, keyed by `pathKey`, with the mtime Vortex recorded at deployment */
  deployed: Map<string, number>;
  /** Whether any Vortex deployment manifest was found */
  hasDeployment: boolean;
  filesWalked: number;
}

export const DEPLOYMENT_MANIFEST = /^vortex\.deployment.*\.json$/i;

// the native walk reports seconds; the fallback outside Windows hands back a Date
function mtimeMsOf(mtime: unknown): number {
  return mtime instanceof Date ? mtime.getTime() : Number(mtime) * 1000;
}

async function walkFolder(
  gamePath: string,
): Promise<{ files: Map<string, IDiskFile>; walked: number }> {
  const files = new Map<string, IDiskFile>();
  let walked = 0;
  await turbowalk(
    gamePath,
    (entries) => {
      for (const entry of entries) {
        if (entry.isDirectory || entry.isTerminator) continue;
        walked++;
        const relPath = path.relative(gamePath, entry.filePath);
        files.set(pathKey(relPath), {
          relPath,
          size: entry.length,
          mtimeMs: mtimeMsOf(entry.mtime),
        });
      }
    },
    { skipHidden: false, skipLinks: true, skipInaccessible: true },
  );
  return { files, walked };
}

interface IDeploymentManifestFile {
  targetPath?: unknown;
  files?: Array<{ relPath?: unknown; target?: unknown; time?: unknown }>;
}

const insideRoot = (root: string, target: string): boolean => {
  const relPath = path.relative(root, target);
  return relPath !== "" && !relPath.startsWith("..") && !path.isAbsolute(relPath);
};

async function readDeploymentManifest(
  gamePath: string,
  manifestRelPath: string,
  deployed: Map<string, number>,
): Promise<void> {
  const jsonPath = path.join(gamePath, manifestRelPath);
  let manifest: IDeploymentManifestFile;
  try {
    manifest = JSON.parse(await readFile(jsonPath, "utf8")) as IDeploymentManifestFile;
  } catch (err) {
    // its files show up as unknown instead
    log("warn", "game folder check skipped a deployment manifest", {
      jsonPath,
      error: getErrorMessageOrDefault(err),
    });
    return;
  }
  // a manifest reached through a junction or subst drive names the folder by another route;
  // it always sits in its own target folder
  const targetPath =
    typeof manifest.targetPath === "string" &&
    (manifest.targetPath === gamePath || insideRoot(gamePath, manifest.targetPath))
      ? manifest.targetPath
      : path.dirname(jsonPath);
  for (const entry of manifest.files ?? []) {
    if (typeof entry.relPath !== "string") continue;
    const target = typeof entry.target === "string" ? entry.target : "";
    const full = path.join(targetPath, target, entry.relPath);
    if (!insideRoot(gamePath, full)) continue;
    deployed.set(pathKey(path.relative(gamePath, full)), Number(entry.time ?? 0));
  }
}

export async function listGameFolder(gamePath: string): Promise<IListing> {
  const { files, walked } = await walkFolder(gamePath);
  const deployed = new Map<string, number>();
  const manifests = [...files.values()].filter((file) =>
    DEPLOYMENT_MANIFEST.test(path.basename(file.relPath)),
  );
  await Promise.all(
    manifests.map((file) => readDeploymentManifest(gamePath, file.relPath, deployed)),
  );
  const hasDeployment = manifests.length > 0;
  return {
    files,
    deployed,
    hasDeployment,
    filesWalked: walked,
  };
}

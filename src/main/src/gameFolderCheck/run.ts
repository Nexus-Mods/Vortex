/** One game folder check: the folder listing and Steam verification run side by side. */
import { stat } from "node:fs/promises";
import path from "node:path";

import { getErrorMessageOrDefault } from "@vortex/shared";
import type {
  GameFolderCheckInput,
  GameFolderCheckOutcome,
  GameFolderCheckResult,
  GameFolderFileReport,
} from "@vortex/shared/ipc";

import { log } from "../logging";
import { loadBaseline, NoBaseline } from "./baseline";
import { listGameFolder, type IListing } from "./listing";
import { reconcile, reportedFiles } from "./reconcile";
import { verifySteamFiles } from "./verify";

export interface IRunOutput {
  result: GameFolderCheckResult;
  /** Every file with its classification; for the dev-build report only */
  files: GameFolderFileReport[];
}

const mtimeOf = (filePath: string): Promise<number | null> =>
  stat(filePath).then(
    (stats) => stats.mtimeMs,
    () => null,
  );

/** `<library>/steamapps/appmanifest_<appid>.acf`, two levels up from `steamapps/common/<game>` */
function acfPath(input: GameFolderCheckInput): string {
  return path.join(path.dirname(path.dirname(input.gamePath)), `appmanifest_${input.appId}.acf`);
}

async function listOrNull(gamePath: string): Promise<IListing | null> {
  try {
    return await listGameFolder(gamePath);
  } catch (err) {
    log("warn", "game folder check couldn't walk the game folder", {
      gamePath,
      error: getErrorMessageOrDefault(err),
    });
    return null;
  }
}

export async function runGameFolderCheck(
  input: GameFolderCheckInput,
  signal: AbortSignal,
): Promise<IRunOutput> {
  const startedAt = Date.now();
  const { steamPath: _steamPath, gamePath: _gamePath, ...reported } = input;
  const acfBefore = await mtimeOf(acfPath(input));
  const folderCreatedAt = await stat(input.gamePath).then(
    (stats) => stats.birthtimeMs,
    () => null,
  );
  const finish = (
    outcome: GameFolderCheckOutcome,
    manifestCreatedAt: Record<string, number | null>,
    filesWalked = 0,
    bytesRead = 0,
  ): GameFolderCheckResult => ({
    ...outcome,
    input: reported,
    folderCreatedAt,
    manifestCreatedAt,
    cost: { durationMs: Date.now() - startedAt, filesWalked, bytesRead },
  });

  let baseline;
  try {
    baseline = await loadBaseline(input);
  } catch (err) {
    if (!(err instanceof NoBaseline)) throw err;
    return { result: finish({ status: "no_baseline", reason: err.reason }, {}), files: [] };
  }

  const [listing, verification] = await Promise.all([
    listOrNull(input.gamePath),
    verifySteamFiles(input.gamePath, baseline, {
      fullVerify: input.fullVerify,
      limits: input.limits,
      startedAt,
      signal,
    }),
  ]);
  signal.throwIfAborted();
  const { manifestCreatedAt } = baseline;

  if (listing === null) {
    return {
      result: finish(
        { status: "aborted", reason: "walk_failed" },
        manifestCreatedAt,
        0,
        verification.bytesRead,
      ),
      files: [],
    };
  }
  if ((await mtimeOf(acfPath(input))) !== acfBefore) {
    const result = finish(
      { status: "aborted", reason: "steam_changed" },
      manifestCreatedAt,
      listing.filesWalked,
      verification.bytesRead,
    );
    return { result, files: [] };
  }

  const { counts, files } = reconcile(baseline, listing, verification, input.fullVerify);
  const result = finish(
    {
      status: "checked",
      verification: verification.status,
      counts,
      deployedBeforeCheck: listing.hasDeployment,
      ...reportedFiles(files, input.limits.maxUnknownPaths, Math.random),
    },
    manifestCreatedAt,
    listing.filesWalked,
    verification.bytesRead,
  );
  return { result, files };
}

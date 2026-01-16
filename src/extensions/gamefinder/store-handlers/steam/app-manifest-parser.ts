/**
 * Parser for Steam's appmanifest_*.acf files
 */

import { join, dirname } from "path";
import { Result, ok, err } from "neverthrow";
import type { GameFinderError } from "../../common";
import type {
  AppManifest,
  InstalledDepot,
  StateFlags,
  AppId,
  DepotId,
} from "./types";
import {
  parseVdfFile,
  getObject,
  getString,
  getRequiredString,
  getNumber,
  getBigInt,
  parseTimestamp,
  type VdfObject,
} from "./vdf-parser";

/**
 * Parse installed depots from the AppState object
 */
function parseInstalledDepots(
  depotsObj: VdfObject | undefined,
): InstalledDepot[] {
  if (depotsObj === undefined) {
    return [];
  }

  const depots: InstalledDepot[] = [];

  for (const [depotIdStr, depotData] of Object.entries(depotsObj)) {
    const depotId = parseInt(depotIdStr, 10) as DepotId;
    if (isNaN(depotId) || typeof depotData !== "object" || depotData === null) {
      continue;
    }

    const manifestId = getBigInt(depotData, "manifest");
    const sizeOnDisk = getBigInt(depotData, "size");
    const dlcAppIdNum = getNumber(depotData, "dlcappid");

    depots.push({
      depotId,
      manifestId,
      sizeOnDisk,
      dlcAppId: dlcAppIdNum as AppId | undefined,
    });
  }

  return depots;
}

/**
 * Parse an appmanifest_*.acf file
 */
export function parseAppManifest(
  filePath: string,
): Result<AppManifest, GameFinderError> {
  const parseResult = parseVdfFile(filePath);
  if (parseResult.isErr()) {
    return err(parseResult.error);
  }

  const root = parseResult.value;

  // The root should contain an "AppState" object
  const appState = getObject(root, "AppState");
  if (appState === undefined) {
    return err({
      code: "VDF_INVALID_FORMAT",
      message: `Invalid appmanifest format: missing 'AppState' root object in ${filePath}`,
    });
  }

  // Parse required fields - appid can be number or string
  const appIdNum = getNumber(appState, "appid");
  if (appIdNum === undefined) {
    return err({
      code: "VDF_MISSING_FIELD",
      message: `Missing required field 'appid' in ${filePath}`,
    });
  }
  const appId = appIdNum as AppId;

  const nameResult = getRequiredString(appState, "name", filePath);
  if (nameResult.isErr()) {
    return err(nameResult.error);
  }

  const installDirResult = getRequiredString(appState, "installdir", filePath);
  if (installDirResult.isErr()) {
    return err(installDirResult.error);
  }

  // Parse state flags
  const stateFlagsNum = getNumber(appState, "StateFlags") ?? 0;
  const stateFlags = stateFlagsNum as StateFlags;

  // Calculate absolute installation directory
  // The manifest is in steamapps/, and installdir is relative to steamapps/common/
  const steamAppsDir = dirname(filePath);
  const installationDirectory = join(
    steamAppsDir,
    "common",
    installDirResult.value,
  );

  // Parse optional fields
  const lastUpdatedStr = getString(appState, "LastUpdated");
  const lastUpdated = parseTimestamp(lastUpdatedStr);
  const sizeOnDisk = getBigInt(appState, "SizeOnDisk");
  const buildIdNum = getNumber(appState, "buildid");
  const lastOwner = getBigInt(appState, "LastOwner");
  const bytesToDownload = getBigInt(appState, "BytesToDownload");
  const bytesDownloaded = getBigInt(appState, "BytesDownloaded");
  const bytesToStage = getBigInt(appState, "BytesToStage");
  const bytesStaged = getBigInt(appState, "BytesStaged");

  // Parse installed depots
  const installedDepots = parseInstalledDepots(
    getObject(appState, "InstalledDepots"),
  );

  return ok({
    appId,
    name: nameResult.value,
    stateFlags,
    installDir: installDirResult.value,
    installationDirectory,
    lastUpdated,
    sizeOnDisk,
    buildId: buildIdNum,
    lastOwner: lastOwner !== BigInt(0) ? lastOwner : undefined,
    bytesToDownload,
    bytesDownloaded,
    bytesToStage,
    bytesStaged,
    installedDepots,
  });
}

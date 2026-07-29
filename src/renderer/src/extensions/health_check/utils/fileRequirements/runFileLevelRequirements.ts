import {
  checkFileLevelRequirements,
  type InstalledFile,
} from "@nexusmods/file-dependency-resolver";
import { getErrorMessage, unknownToError } from "@vortex/shared";

import { activeProfile } from "@/extensions/profile_management/selectors";
import { log } from "@/logging";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type { IModDetails } from "../../types";
import { getModDetails } from "../shared/modDetails";
import { createResolverPorts } from "./fileDependencyPorts";
import {
  gatherDownloadedFileRefs,
  gatherInstalledFiles,
  makeDownloadedFileHydrator,
  makeInstalledFileHydrator,
  type IDownloadedFile,
  type IInstalledFile,
} from "./installedFiles";
import {
  type HydrateFile,
  type IFileRequirement,
  type IFileRequirementBranch,
  type IFileRequirementsCheckMetadata,
  mapRequirementsReport,
} from "./mapRequirementsReport";

/** A file the user already has, installed or only downloaded. */
type IOwnedFile = IInstalledFile | IDownloadedFile;

/** The already-owned files (installed or downloaded) one OR alternative surfaces. */
function branchOwnedFiles(branch: IFileRequirementBranch): IOwnedFile[] {
  switch (branch.kind) {
    case "download":
      return [];
    case "install":
      return [branch.uninstalledFile, ...(branch.enabledFile ? [branch.enabledFile] : [])];
    case "enable":
      return [branch.correctFile, ...(branch.enabledFile ? [branch.enabledFile] : [])];
  }
}

/** The already-owned files one requirement surfaces; download candidates come hydrated. */
function ownedFiles(requirement: IFileRequirement): IOwnedFile[] {
  switch (requirement.kind) {
    case "missing":
      return [];
    case "wrong-version-installed":
      return [requirement.installedFile];
    case "wrong-version-enabled":
      return [requirement.correctFile, requirement.enabledFile];
    case "correct-version-uninstalled":
      return [
        requirement.uninstalledFile,
        ...(requirement.enabledFile ? [requirement.enabledFile] : []),
      ];
    case "or":
      return requirement.branches.flatMap(branchOwnedFiles);
  }
}

/**
 * Mod UIDs of the owned files the check surfaces. Their thumbnail and adult flag - plus
 * the summary, for downloads - come from the local mod / download record, which can be
 * incomplete or stale, so they are backfilled from the mods endpoint.
 */
function surfacedModUIDs(metadata: IFileRequirementsCheckMetadata): string[] {
  const uids = new Set<string>();
  for (const fileReq of Object.values(metadata.fileRequirements)) {
    for (const file of fileReq.requirements.flatMap(ownedFiles)) {
      if (file.modUID) {
        uids.add(file.modUID);
      }
    }
  }
  return [...uids];
}

/**
 * Resolve the active game's file-level requirements: gather installed and
 * downloaded files, run the dependency resolver against the Nexus v3 ports,
 * then map the report onto Vortex's check metadata.
 */
export async function runFileLevelRequirements(
  api: IExtensionApi,
): Promise<IFileRequirementsCheckMetadata> {
  const gameId = activeProfile(api.getState())?.gameId ?? "";

  const [installedRefs, downloadedRefs] = await Promise.all([
    gatherInstalledFiles(api),
    gatherDownloadedFileRefs(api),
  ]);

  if (installedRefs.length === 0) {
    return { gameId, modsChecked: 0, fileRequirements: {}, errors: [] };
  }

  const installedFiles: InstalledFile[] = installedRefs.map((ref) => ({
    fileVersionUid: ref.fileUID,
    enabled: ref.enabled,
    emitRequirements: ref.emitRequirements,
  }));

  const report = await checkFileLevelRequirements({
    installedFiles,
    uninstalledFileVersionUids: new Set(downloadedRefs.map((ref) => ref.fileUID)),
    ports: createResolverPorts(api),
  });

  const buildHydrate = (modDetailsByUID: Map<string, IModDetails>): HydrateFile => {
    const hydrateInstalled = makeInstalledFileHydrator(api, installedRefs, modDetailsByUID);
    const hydrateDownloaded = makeDownloadedFileHydrator(api, downloadedRefs, modDetailsByUID);
    return (fileUID) => {
      const installed = hydrateInstalled(fileUID);
      if (installed) return { kind: "installed", file: installed };
      const downloaded = hydrateDownloaded(fileUID);
      if (downloaded) return { kind: "downloaded", file: downloaded };
      return undefined;
    };
  };

  const context = { gameId, modsChecked: installedRefs.length, errors: [] };

  // First pass without mod details reveals which owned files the check actually
  // surfaces, so we only fetch details for those.
  const initial = mapRequirementsReport(report, buildHydrate(new Map()), context);
  const modUIDs = surfacedModUIDs(initial);
  if (modUIDs.length === 0) {
    return initial;
  }

  // Backfill display data (thumbnail, summary, adult flag) via the batched, cached
  // mod-details endpoint, then re-map with it. See toDownloadedFile / toInstalledFile.
  const details = await getModDetails(api, modUIDs).catch((err: unknown): IModDetails[] => {
    log("warn", "failed to fetch mod details for file requirements", {
      count: modUIDs.length,
      error: getErrorMessage(unknownToError(err)),
    });
    return [];
  });
  if (details.length === 0) {
    // Nothing to backfill, so a second pass would reproduce what we already have.
    return initial;
  }

  const modDetailsByUID = new Map(details.map((detail) => [detail.modUID, detail]));
  return mapRequirementsReport(report, buildHydrate(modDetailsByUID), context);
}

import {
  checkFileLevelRequirements,
  type InstalledFile,
} from "@nexusmods/file-dependency-resolver";

import { activeProfile } from "@/extensions/profile_management/selectors";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type { IModDetails } from "../../types";
import { getModDetails } from "../shared/modDetails";
import { createResolverPorts } from "./fileDependencyPorts";
import {
  gatherDownloadedFileRefs,
  gatherInstalledFiles,
  makeDownloadedFileHydrator,
  makeInstalledFileHydrator,
} from "./installedFiles";
import {
  type HydrateFile,
  type IFileRequirementsCheckMetadata,
  mapRequirementsReport,
} from "./mapRequirementsReport";

/** Mod UIDs of the downloaded-but-not-installed archives the check surfaces. */
function surfacedDownloadModUIDs(metadata: IFileRequirementsCheckMetadata): string[] {
  const uids = new Set<string>();
  for (const fileReq of Object.values(metadata.fileRequirements)) {
    for (const req of fileReq.requirements) {
      if (req.kind === "correct-version-uninstalled" && req.uninstalledFile.modUID) {
        uids.add(req.uninstalledFile.modUID);
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

  const hydrateInstalled = makeInstalledFileHydrator(api, installedRefs);
  const buildHydrate = (modDetailsByUID: Map<string, IModDetails>): HydrateFile => {
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

  // First pass without mod details reveals which downloaded archives the check
  // actually surfaces, so we only fetch details for those.
  const initial = mapRequirementsReport(report, buildHydrate(new Map()), context);
  const modUIDs = surfacedDownloadModUIDs(initial);
  if (modUIDs.length === 0) {
    return initial;
  }

  // Backfill display data (thumbnail, summary, adult flag) missing from those
  // unenriched downloads via the batched, cached mod-details endpoint, then
  // re-map with it. See toDownloadedFile.
  const details = await getModDetails(api, modUIDs).catch((): IModDetails[] => []);
  const modDetailsByUID = new Map(details.map((detail) => [detail.modUID, detail]));
  return mapRequirementsReport(report, buildHydrate(modDetailsByUID), context);
}

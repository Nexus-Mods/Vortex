import {
  checkFileLevelRequirements,
  type InstalledFile,
} from "@nexusmods/file-dependency-resolver";

import { activeProfile } from "@/extensions/profile_management/selectors";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { createResolverPorts } from "./fileDependencyPorts";
import {
  gatherDownloadedFileRefs,
  gatherInstalledFiles,
  makeDownloadedFileHydrator,
  makeInstalledFileHydrator,
} from "./installedFiles";
import {
  type HydratedFile,
  type IFileRequirementsCheckMetadata,
  mapRequirementsReport,
} from "./mapRequirementsReport";

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
  const hydrateDownloaded = makeDownloadedFileHydrator(api, downloadedRefs);
  const hydrate = (fileUID: string): HydratedFile | undefined => {
    const installed = hydrateInstalled(fileUID);
    if (installed) return { kind: "installed", file: installed };
    const downloaded = hydrateDownloaded(fileUID);
    if (downloaded) return { kind: "downloaded", file: downloaded };
    return undefined;
  };

  return mapRequirementsReport(report, hydrate, {
    gameId,
    modsChecked: installedRefs.length,
    errors: [],
  });
}

import {
  checkFileLevelRequirements,
  type InstalledFile,
} from "@nexusmods/file-dependency-resolver";

import type { IFileRequirementsCheckMetadata } from "@/extensions/health_check/types";
import { activeProfile } from "@/extensions/profile_management/selectors";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { createResolverPorts } from "./fileDependencyPorts";
import { gatherInstalledFiles, makeInstalledFileHydrator } from "./installedFiles";
import { mapRequirementsReport } from "./mapRequirementsReport";

/**
 * Resolve the active game's file-level requirements: gather installed files,
 * run the dependency resolver against the Nexus v3 ports, then map the report
 * onto Vortex's check metadata.
 */
export async function runFileLevelRequirements(
  api: IExtensionApi,
): Promise<IFileRequirementsCheckMetadata> {
  const gameId = activeProfile(api.getState())?.gameId ?? "";

  const refs = await gatherInstalledFiles(api);
  if (refs.length === 0) {
    return { gameId, modsChecked: 0, fileRequirements: {}, errors: [] };
  }

  const installedFiles: InstalledFile[] = refs.map((ref) => ({
    fileVersionUid: ref.fileUID,
    enabled: ref.enabled,
    emitRequirements: ref.emitRequirements,
  }));

  const report = await checkFileLevelRequirements({
    installedFiles,
    ports: createResolverPorts(api),
  });

  return mapRequirementsReport(report, makeInstalledFileHydrator(api, refs), {
    gameId,
    modsChecked: refs.length,
    errors: [],
  });
}

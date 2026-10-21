import * as path from "node:path";

import type { components, NexusV3Client } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault } from "@vortex/shared";
import { z } from "zod";

import { fetchVersionDetailRows } from "@/extensions/health_check/utils/fileRequirements/fileDependencyPorts";
import { mapWithConcurrency } from "@/extensions/mod_management/LinkingDeployment";
import { log } from "@/logging";

const MANIFEST_CONCURRENCY = 16;

/** A file inside a Nexus archive, as the archive's manifest lists it. */
export interface IArchiveFile {
  /** "/" separated, inside the archive */
  path: string;
  size: number;
  md5: string;
}

/** An archive's files, keyed by file name. */
export type ArchiveFiles = ReadonlyMap<string, IArchiveFile[]>;

const archiveManifestFileSchema = z.object({
  file_path: z.string(),
  file_size: z.number(),
  file_hashes: z.object({ MD5: z.string() }),
});

/** The fields read from a file entry of an archive manifest. */
export type ArchiveManifestFile = z.infer<typeof archiveManifestFileSchema>;

const archiveManifestSchema = z.object({ files: z.array(archiveManifestFileSchema) });

async function fetchArchiveManifest(manifestUrl: string): Promise<ArchiveFiles | undefined> {
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      // a new upload's manifest is missing until it is processed
      return undefined;
    }
    const { files } = archiveManifestSchema.parse(await response.json());
    return Map.groupBy(
      files.map(
        (file): IArchiveFile => ({
          path: file.file_path,
          size: file.file_size,
          md5: file.file_hashes.MD5,
        }),
      ),
      (archiveFile) => path.posix.basename(archiveFile.path),
    );
  } catch (err) {
    log("debug", "failed to read archive manifest", {
      manifestUrl,
      error: getErrorMessageOrDefault(err),
    });
    return undefined;
  }
}

/** The archive files of each file version with a manifest, keyed by file version uid. */
export async function fetchArchiveFiles(
  client: NexusV3Client,
  versionIds: string[],
): Promise<Map<string, ArchiveFiles>> {
  let versions: components["schemas"]["ModFileVersionDetail"][] = [];
  try {
    versions = await fetchVersionDetailRows(client, versionIds);
  } catch (err) {
    log("warn", "failed to look up archive manifests", {
      error: getErrorMessageOrDefault(err),
    });
  }

  const manifestUrls = versions.flatMap((version) =>
    version.manifest_url !== null ? [[version.id, version.manifest_url] as const] : [],
  );
  const archiveFilesByVersion = await mapWithConcurrency(
    manifestUrls,
    async ([versionId, manifestUrl]) =>
      [versionId, await fetchArchiveManifest(manifestUrl)] as const,
    MANIFEST_CONCURRENCY,
  );
  return new Map(
    archiveFilesByVersion.filter(
      (entry): entry is readonly [string, ArchiveFiles] => entry[1] !== undefined,
    ),
  );
}

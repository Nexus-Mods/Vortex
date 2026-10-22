import { lockfileFiles, type GeneratedFileSource, type Lockfile } from "@nexusmods/mod-pipeline";

/** The lockfile plus the generated files, each replacing any mod file at its destination. */
export function addGeneratedFiles(
  lockfile: Lockfile,
  generatedFiles: GeneratedFileSource[],
): Lockfile {
  return { ...lockfile, files: lockfileFiles([...lockfile.files, ...generatedFiles]) };
}

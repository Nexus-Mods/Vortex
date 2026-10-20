import { byDestinationPath, type GeneratedFileSource, type Lockfile } from "./lockfile";

/** The lockfile plus the generated files, each replacing any mod file at its destination. */
export function addGeneratedFiles(
  lockfile: Lockfile,
  generatedFiles: GeneratedFileSource[],
): Lockfile {
  if (generatedFiles.length === 0) {
    return lockfile;
  }
  const fileByDestination = new Map(lockfile.files.map((file) => [file.destinationPath, file]));
  const generatedDestinations = new Set<string>();
  for (const generatedFile of generatedFiles) {
    if (generatedDestinations.has(generatedFile.destinationPath)) {
      throw new Error(`${generatedFile.destinationPath} is generated twice`);
    }
    generatedDestinations.add(generatedFile.destinationPath);
    fileByDestination.set(generatedFile.destinationPath, generatedFile);
  }
  return { ...lockfile, files: [...fileByDestination.values()].toSorted(byDestinationPath) };
}

import { FileSourceKind, HashType, type GeneratedFileSource } from "./lockfile";

/** A generated plugins.txt. */
export function makeGeneratedFile(
  overrides: Partial<GeneratedFileSource> = {},
): GeneratedFileSource {
  return {
    source: FileSourceKind.VortexGenerated,
    destinationPath: "/fixture-root/appdata/Skyrim Special Edition/plugins.txt",
    fileHash: "plugins-txt-hash",
    hashType: HashType.Md5,
    ...overrides,
  };
}

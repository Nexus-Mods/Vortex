/**
 * Mods are laid out as `<modFolder>/content/...`, and that folder name is what
 * ends up as the section name in mods.settings and as the directory the game
 * scans. Kept free of Vortex API imports so it can be unit tested.
 */

/** Folder name a deployed file belongs to, or undefined if it isn't in one. */
export function modFolderNameFromPath(filePath: string): string | undefined {
  const segments = filePath.split(/[\\/]/);
  const contentIdx = segments.findIndex((seg) => seg.toLowerCase() === "content");
  // A `content` segment at the root has no mod folder in front of it.
  return [-1, 0].includes(contentIdx) ? undefined : segments[contentIdx - 1];
}

/**
 * Builds the `mod`-prefixed folder name an archive installs into.
 *
 * Only over-long names are shortened, so names that already fit come out
 * byte-identical to what earlier versions produced and existing deployments
 * keep their folders.
 */
export function makeModFolderName(archiveName: string, maxLength: number): string {
  const name = "mod" + archiveName.replace(/\s/g, "");
  if (name.length <= maxLength) {
    return name;
  }
  // Keep a short suffix of the original so two long names can't collapse
  // into the same folder.
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const suffix = "_" + hash.toString(36);
  return name.slice(0, maxLength - suffix.length) + suffix;
}

export function modFolderNames(filePaths: string[]): string[] {
  const names = new Set<string>();
  for (const filePath of filePaths) {
    const name = modFolderNameFromPath(filePath);
    if (name !== undefined) {
      names.add(name);
    }
  }
  return Array.from(names);
}

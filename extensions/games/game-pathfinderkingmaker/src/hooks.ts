/**
 * Imperative install hooks for the Pathfinder: Kingmaker GDL extension.
 *
 * Two mod shapes need logic GDL cannot express declaratively, and both deploy
 * outside the game's Mods folder (portraits to the user's LocalLow profile,
 * voice banks to the game's audio folder). Doing the placement in a hook also
 * keeps the install free of context-binding interpolation, which only resolves
 * once Vortex has run the game's setup.
 *
 *   - installPortrait: a portrait is a folder holding the Small/Medium/Fulllength
 *     PNG trio. Archives ship them as a single named folder, several folders
 *     under a Portraits/ wrapper, or loose at the archive root with no folder.
 *     The hook finds every trio folder and deploys each as Portraits/<name>/,
 *     synthesising a name from the mod for the loose-at-root case.
 *   - installVoice: Wwise .bnk soundbanks that overwrite the game's banks. The
 *     hook flattens every .bnk into the audio folder. Packs that bundle several
 *     variants of the same bank are a "pick one" choice an installer cannot
 *     make, so those deploy to the Mods folder unchanged for the user to resolve.
 *
 * These hooks are game-agnostic; the Wrath of the Righteous extension uses an
 * identical copy. The per-game audio and portrait paths live in game.yaml.
 */
import { types } from "@nexusmods/vortex-api";

const PORTRAIT_MOD_TYPE = "portrait";
const VOICE_MOD_TYPE = "voice";

const isDir = (file: string): boolean => file.endsWith("/") || file.endsWith("\\");
const baseName = (file: string): string => file.split(/[\\/]/).pop() ?? file;
const dirName = (file: string): string => {
  const norm = file.replace(/\\/g, "/");
  const slash = norm.lastIndexOf("/");
  return slash < 0 ? "" : norm.slice(0, slash);
};
const isImage = (file: string): boolean => /\.(png|jpe?g|webp)$/i.test(file);

/** Turn a staging-folder path into a stable, unique portrait subfolder name. */
function portraitFolderName(destinationPath: string): string {
  const name = baseName(destinationPath)
    .replace(/\.installing$/i, "")
    .trim();
  return name.length > 0 ? name : "Portrait";
}

/**
 * Deploy every portrait folder (a directory holding the Small/Medium/Fulllength
 * trio) as Portraits/<folder>/. Handles single-folder, multi-portrait wrapper,
 * and loose-at-root archives at any nesting depth. Non-image files are dropped.
 */
export async function installPortrait(
  files: string[],
  destinationPath: string,
): Promise<types.IInstallResult> {
  const byDir = new Map<string, string[]>();
  for (const file of files) {
    if (isDir(file)) continue;
    const dir = dirName(file);
    const list = byDir.get(dir) ?? [];
    list.push(file);
    byDir.set(dir, list);
  }

  const hasTrio = (dirFiles: string[]): boolean => {
    const names = new Set(dirFiles.map((f) => baseName(f).toLowerCase()));
    return names.has("fulllength.png") && names.has("medium.png") && names.has("small.png");
  };

  const copies: types.IInstruction[] = [];
  for (const [dir, dirFiles] of byDir) {
    if (!hasTrio(dirFiles)) continue;
    const folder = dir === "" ? portraitFolderName(destinationPath) : baseName(dir);
    for (const file of dirFiles) {
      if (isImage(file)) {
        copies.push({
          type: "copy" as const,
          source: file,
          destination: `${folder}/${baseName(file)}`,
        });
      }
    }
  }

  return {
    instructions: [{ type: "setmodtype" as const, value: PORTRAIT_MOD_TYPE }, ...copies],
  };
}

/**
 * Voice soundbank: flatten every .bnk into the audio folder. If the archive
 * bundles multiple variants of the same bank (the same .bnk filename under more
 * than one folder), defer to the Mods folder by preserving the archive layout
 * and leaving the mod type at its default, so the user can pick a variant.
 */
export async function installVoice(
  files: string[],
  _destinationPath: string,
): Promise<types.IInstallResult> {
  const bnks = files.filter((file) => !isDir(file) && /\.bnk$/i.test(file));

  const counts = new Map<string, number>();
  for (const bnk of bnks) {
    const key = baseName(bnk).toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const multiVariant = [...counts.values()].some((count) => count > 1);

  if (multiVariant) {
    const copies: types.IInstruction[] = files
      .filter((file) => !isDir(file))
      .map((file) => ({ type: "copy" as const, source: file, destination: file }));
    return { instructions: copies };
  }

  const copies: types.IInstruction[] = bnks.map((bnk) => ({
    type: "copy" as const,
    source: bnk,
    destination: baseName(bnk),
  }));
  return {
    instructions: [{ type: "setmodtype" as const, value: VOICE_MOD_TYPE }, ...copies],
  };
}

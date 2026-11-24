import { QualifiedPath } from "@nexusmods/paths";

import { z } from "./zodJitless";

function isAbsolutePath(path: string): boolean {
  try {
    return QualifiedPath.fromNative(path).path === path;
  } catch {
    return false;
  }
}

/** Every path field of the contract: absolute, sanitized and "/" separated. */
export const AbsolutePathSchema: z.ZodType<string> = z
  .string()
  .refine(isAbsolutePath, { message: 'not an absolute, "/" separated path' });

/**
 * The key paths are matched by, as today's deploy files them: letter case never tells paths apart,
 * and an accented letter is the same however it is encoded.
 */
export const pathKeyOf = (path: string): string => path.toUpperCase().normalize("NFC");

/** A path below a folder that the contract rejects: an empty, "." or ".." segment, or a "\" or ":". */
export const INVALID_RELATIVE_PATH: RegExp = /(^|\/)\.{0,2}(\/|$)|[\\:]/;

/** The key every path inside a folder starts with. */
export const folderKeyOf = (folder: string): string =>
  pathKeyOf(folder.endsWith("/") ? folder : `${folder}/`);

/**
 * Extract icons from Windows PE executables.
 *
 * Drop-in replacement for the native icon-extract package. Parses PE headers
 * directly in TypeScript — no native addons, GDI+, or shell API dependency.
 */

export { extractIcon, extractIconToFile } from "./peIcon";
export type { ExtractedIcon } from "./peIcon";

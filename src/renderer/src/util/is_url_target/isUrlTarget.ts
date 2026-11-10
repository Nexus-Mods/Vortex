import path from "node:path";

/**
 * Whether `target` should open as a URL rather than as a file or folder. Anything that isn't an
 * absolute path and parses as a URL with a scheme counts; everything else (relative paths,
 * schemeless hosts) is treated as a path.
 */
export function isUrlTarget(target: string): boolean {
  if (path.win32.isAbsolute(target)) {
    return false;
  }

  try {
    const parsed = new URL(target);
    return parsed.protocol.length > 1;
  } catch {
    return false;
  }
}

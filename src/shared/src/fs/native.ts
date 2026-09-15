/**
 * Low-level native path utilities.
 *
 * Handles parsing and normalization of raw native paths for all platforms
 * independently of the current host platform. A path's format is detected
 * from the path itself, not from the OS the code runs on.
 *
 * All paths handled by these functions are expected to be *sanitized*:
 *
 * 1. Backslashes are converted to forward slashes.
 * 2. Duplicate directory separators are collapsed, except for the leading
 *    `//` of UNC and DOS device paths.
 * 3. Trailing directory separators are removed, except on root directories.
 * 4. Trailing whitespace is removed.
 *
 * @public */

import { VortexError } from "../errors/base";

/** Directory separator character used by all sanitized paths. @public */
export const DIRECTORY_SEPARATOR = "/";

const INVALID_CHARACTERS = [
  "\uFFFD", // � REPLACEMENT CHARACTER used to replace an unknown, unrecognised, or unrepresentable character
  "\uFFFE", // <noncharacter-FFFE> not a character
  "\uFFFF", // <noncharacter-FFFF> not a character
] as const;

const DOS_ROOT_LENGTH = "C:/".length;
const MIN_UNC_ROOT_LENGTH = "//A/".length;
const DOS_DEVICE_PREFIX_LENGTH = "//./".length;
const DOS_DEVICE_DRIVE_ROOT_LENGTH = "//./C:/".length;
const DOS_DEVICE_VOLUME_ROOT_LENGTH = `//./Volume{00000000-0000-0000-0000-000000000000}/`.length;
const DOS_DEVICE_VOLUME_PREFIX = "Volume{";

/**
 * The type of a path's root.
 *
 * For Windows paths see https://learn.microsoft.com/en-us/dotnet/standard/io/file-path-formats
 *
 * @public */
export type PathRootType =
  /** The path isn't rooted. */
  | "None"
  /** A Unix-style root. @example `/` */
  | "Unix"
  /** A DOS root. @example `C:/` */
  | "DOS"
  /** A UNC root. @example `//Server/` */
  | "UNC"
  /** A DOS device path with a drive letter. @example `//./C:/` or `//?/C:/` */
  | "DOSDeviceDrive"
  /** A DOS device path with a volume GUID. @example `//./Volume{b75e2c83-0000-0000-0000-602f00000000}/` */
  | "DOSDeviceVolume";

/**
 * The root part of a path and its type.
 * @public */
export type PathRoot = {
  /** The root part of the path. Empty if the path isn't rooted. */
  readonly span: string;
  /** The type of the root. */
  readonly type: PathRootType;
};

/**
 * The result of parsing a raw native path.
 * @public */
export type ParsedNativePath = {
  /** The sanitized path. */
  readonly normalizedPath: string;
  /** The root part of the path. */
  readonly root: PathRoot;
};

/**
 * Returns whether the character is a valid Windows drive letter.
 *
 * @public */
export function isValidWindowsDriveChar(value: string | undefined): boolean {
  if (value === undefined) return false;

  const lower = value.toLowerCase();
  return lower.length === 1 && lower >= "a" && lower <= "z";
}

/**
 * Returns whether the root type is a Unix-style root.
 * @public */
export function isUnixRootType(type: PathRootType): boolean {
  return type === "Unix";
}

/**
 * Returns whether the root type is a Windows-style root.
 * @public */
export function isWindowsRootType(type: PathRootType): boolean {
  return (
    type === "DOS" || type === "UNC" || type === "DOSDeviceDrive" || type === "DOSDeviceVolume"
  );
}

/**
 * Returns the root part of a sanitized path and its type.
 *
 * @throws {@link VortexError} for invalid paths
 *
 * @example
 * ```ts @import.meta.vitest
 * assert(getPathRoot("/foo/bar").type === "Unix");
 * assert(getPathRoot("C:/foo/bar").type === "DOS");
 * assert(getPathRoot("//Server/foo").type === "UNC");
 * assert(getPathRoot("relative/path").type === "None");
 * ```
 *
 * @public */
export function getPathRoot(path: string): PathRoot {
  if (path.length === 0) return { span: "", type: "None" };

  // DOS paths and relative paths don't start with a `/`
  if (path[0] !== DIRECTORY_SEPARATOR) {
    if (path.length < DOS_ROOT_LENGTH) return { span: "", type: "None" };
    if (path[1] !== ":") return { span: "", type: "None" };
    if (path[2] !== DIRECTORY_SEPARATOR) return { span: "", type: "None" };

    const drive = path[0];
    if (!isValidWindowsDriveChar(drive)) {
      throw new VortexError(
        `Path contains invalid windows drive character: "${path}" ("${drive}")`,
        { kind: "fs:invalid-path", path },
      );
    }

    return { span: path.slice(0, DOS_ROOT_LENGTH), type: "DOS" };
  }

  if (path.length === 1) return { span: path, type: "Unix" };

  // UNC and DOS device paths start with `//`
  if (path[1] !== DIRECTORY_SEPARATOR) return { span: path.slice(0, 1), type: "Unix" };

  if (path.length < MIN_UNC_ROOT_LENGTH) {
    throw new VortexError(`Path is too small to be a valid rooted path: "${path}"`, {
      kind: "fs:invalid-path",
      path,
    });
  }

  const deviceChar = path[2];
  const isDOSDevice =
    path.length >= DOS_DEVICE_DRIVE_ROOT_LENGTH &&
    (deviceChar === "." || deviceChar === "?") &&
    path.charAt(3) === DIRECTORY_SEPARATOR;

  if (!isDOSDevice) {
    // UNC: `//Server/Share/` - server and share together make up the volume
    const rest = path.slice(2);
    const shareSeparatorIndex = rest.indexOf(DIRECTORY_SEPARATOR);
    if (shareSeparatorIndex === -1) {
      throw new VortexError(`Invalid UNC path, missing share: "${path}"`, {
        kind: "fs:invalid-path",
        path,
      });
    }

    const afterServer = rest.slice(shareSeparatorIndex + 1);
    if (afterServer.length === 0) {
      throw new VortexError(`Invalid UNC path, missing share: "${path}"`, {
        kind: "fs:invalid-path",
        path,
      });
    }

    const shareEndIndex = afterServer.indexOf(DIRECTORY_SEPARATOR);
    if (shareEndIndex === -1) {
      // bare volume: the whole path is the root
      return { span: path, type: "UNC" };
    }

    return {
      span: path.slice(0, 2 + shareSeparatorIndex + 1 + shareEndIndex + 1),
      type: "UNC",
    };
  }

  // DOS device drive: `//./C:/` or `//?/C:/`
  if (path[5] === ":" && path[6] === DIRECTORY_SEPARATOR) {
    const drive = path[4];
    if (!isValidWindowsDriveChar(drive)) {
      throw new VortexError(
        `Path contains invalid windows drive character: "${path}" ("${drive}")`,
        { kind: "fs:invalid-path", path },
      );
    }

    return { span: path.slice(0, DOS_DEVICE_DRIVE_ROOT_LENGTH), type: "DOSDeviceDrive" };
  }

  // DOS device volume: `//./Volume{guid}/`
  if (path.length < DOS_DEVICE_VOLUME_ROOT_LENGTH) {
    throw new VortexError(`Path is not a valid DOS Device Volume path: "${path}"`, {
      kind: "fs:invalid-path",
      path,
    });
  }

  if (
    path.slice(
      DOS_DEVICE_PREFIX_LENGTH,
      DOS_DEVICE_PREFIX_LENGTH + DOS_DEVICE_VOLUME_PREFIX.length,
    ) !== DOS_DEVICE_VOLUME_PREFIX
  ) {
    throw new VortexError(`Path is missing DOS Device Volume prefix: "${path}"`, {
      kind: "fs:invalid-path",
      path,
    });
  }

  if (path.charAt(DOS_DEVICE_VOLUME_ROOT_LENGTH - 2) !== "}") {
    throw new VortexError(
      `Invalid DOS Device Volume path, missing directory separator: "${path}"`,
      { kind: "fs:invalid-path", path },
    );
  }

  return { span: path.slice(0, DOS_DEVICE_VOLUME_ROOT_LENGTH), type: "DOSDeviceVolume" };
}

/**
 * Returns whether the sanitized path is a root directory.
 * @public */
export function isRootDirectory(path: string): boolean {
  return getRootLength(path) === path.length;
}

/**
 * Returns the length of the root part of a sanitized path, or `-1` if the
 * path isn't rooted.
 *
 * @public */
export function getRootLength(path: string): number {
  const root = getPathRoot(path);
  return root.type === "None" ? -1 : root.span.length;
}

/**
 * Returns whether the sanitized path is rooted.
 *
 * @public */
export function isRooted(path: string): boolean {
  return getPathRoot(path).type !== "None";
}

/**
 * Returns whether the input is sanitized.
 *
 * @public */
export function isPathSanitized(input: string): boolean {
  if (input.length === 0) return true;
  for (const invalid of INVALID_CHARACTERS) {
    if (input.includes(invalid)) {
      throw new VortexError(
        `Input contains invalid characters: "${input}" (length=${input.length})`,
        { kind: "fs:invalid-path", path: input },
      );
    }
  }

  if (input.includes("\\")) return false;

  const doubleSeparatorIndex = input.lastIndexOf(DIRECTORY_SEPARATOR + DIRECTORY_SEPARATOR);
  if (doubleSeparatorIndex > 0 || (doubleSeparatorIndex === 0 && input.length === 2)) return false;

  if (input.endsWith(" ")) return false;

  // The bare UNC volume is the only rooted shape whose canonical form ends
  // with a directory separator, so it must not appear without one.
  const root = getPathRoot(input);
  if (root.type === "UNC" && root.span === input && !input.endsWith(DIRECTORY_SEPARATOR)) {
    return false;
  }

  if (isRootDirectory(input)) return true;
  return !input.endsWith(DIRECTORY_SEPARATOR);
}

/**
 * Returns a sanitized path that is valid to be used with the other functions
 * in this module.
 *
 * Sanitization does the following:
 * 1. Turns `\` into `/`
 * 2. Removes duplicate directory separators, eg `/foo//bar` turns into `/foo/bar`
 * 3. Removes trailing directory separators from any path that isn't a root
 *    directory, eg `/foo/bar/` turns into `/foo/bar`
 * 4. Removes trailing whitespace
 *
 * @example
 * ```ts @import.meta.vitest
 * assert(sanitizePath("C:\\Users\\alice\\") === "C:/Users/alice");
 * assert(sanitizePath("/foo//bar///baz") === "/foo/bar/baz");
 * assert(sanitizePath("\\\\Server\\share\\") === "//Server/share/");
 * ```
 *
 * @public */
export function sanitizePath(input: string): string {
  if (input.length === 0) return "";
  if (isPathSanitized(input)) return input;

  let result = "";
  let previousWasSeparator = false;

  for (let index = 0; index < input.length; index++) {
    let current = input.charAt(index);
    if (current === "\\") current = DIRECTORY_SEPARATOR;

    const isSeparator = current === DIRECTORY_SEPARATOR;
    if (isSeparator && previousWasSeparator) {
      // Two consecutive directory separators are only valid at the very
      // beginning, where they mark a UNC or DOS device path root.
      if (index !== 1) continue;
      if (input.length === 2) return DIRECTORY_SEPARATOR;
    }

    result += current;
    previousWasSeparator = isSeparator;
  }

  const trimmed = result.replace(/\s+$/, "");

  // Every rooted path ends with a directory separator in its canonical
  // form. The bare UNC volume (`//server/share`) is the only rooted shape
  // that can appear without one, so append the separator here.
  const root = getPathRoot(trimmed);
  if (root.type === "UNC" && root.span === trimmed && !trimmed.endsWith(DIRECTORY_SEPARATOR)) {
    return `${trimmed}/`;
  }

  // Don't remove the trailing directory separator of root directories
  return isRootDirectory(trimmed) ? trimmed : removeTrailingDirectorySeparator(trimmed);
}

function removeTrailingDirectorySeparator(path: string): string {
  if (path.length < 2) return path;
  return path.endsWith(DIRECTORY_SEPARATOR) ? path.slice(0, -1) : path;
}

/**
 * Parses a raw native path of any platform into a sanitized path and its
 * root. The current host platform is irrelevant: a Windows path parses the
 * same way on Linux as it does on Windows.
 *
 * @example
 * ```ts @import.meta.vitest
 * const dos = parseNativePath("C:\\Users\\alice\\file.txt");
 * assert(dos.normalizedPath === "C:/Users/alice/file.txt");
 * assert(dos.root.type === "DOS");
 *
 * const unix = parseNativePath("/home/alice/file.txt");
 * assert(unix.root.type === "Unix");
 * ```
 *
 * @public */
export function parseNativePath(input: string): ParsedNativePath {
  const normalizedPath = sanitizePath(input);
  return { normalizedPath, root: getPathRoot(normalizedPath) };
}

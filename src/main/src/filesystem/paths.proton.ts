import { posix as pathPosix } from "node:path";

import type { PathResolver, QualifiedPath, ResolvedPath } from "@nexusmods/adaptor-api/fs";
import { PathResolverError } from "@nexusmods/adaptor-api/fs";

const PROTON_DATA_PREFIX = "proton:";

export function encodeProtonCompatDataPath(compatDataPath: string): string {
  const normalized = compatDataPath.replace(/\\/g, "/").replace(/\/+$/, "");
  return `${PROTON_DATA_PREFIX}${encodeURIComponent(normalized)}`;
}

export function decodeProtonCompatDataPath(data: string): string | undefined {
  if (!data.startsWith(PROTON_DATA_PREFIX)) {
    return undefined;
  }

  const encoded = data.slice(PROTON_DATA_PREFIX.length);
  if (encoded.length === 0) {
    return undefined;
  }

  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}

function parseWindowsDrivePath(pathValue: string): { drive: string; tail: string } {
  if (!pathValue.startsWith("/")) {
    throw new PathResolverError(`Invalid Proton windows path '${pathValue}': must be rooted`);
  }

  const rest = pathValue.slice(1);
  const slash = rest.indexOf("/");
  const drive = slash === -1 ? rest : rest.slice(0, slash);
  if (!/^[A-Za-z]$/.test(drive)) {
    throw new PathResolverError(
      `Invalid Proton windows path '${pathValue}': first component must be a drive letter`,
    );
  }

  return {
    drive: drive.toUpperCase(),
    tail: slash === -1 ? "" : rest.slice(slash + 1),
  };
}

export function resolveProtonWindowsPath(
  compatDataPath: string,
  pathValue: string,
): ResolvedPath {
  const { drive, tail } = parseWindowsDrivePath(pathValue);
  const tailParts = tail.split("/").filter((segment) => segment.length > 0);

  if (drive === "C") {
    return pathPosix.join(compatDataPath, "pfx", "drive_c", ...tailParts);
  }

  if (drive === "Z") {
    return tailParts.length === 0 ? "/" : pathPosix.join("/", ...tailParts);
  }

  throw new PathResolverError(
    `Unsupported Proton drive '${drive}:' (only C: and Z: are mapped)`,
  );
}

/**
 * Resolves Proton-tagged Windows QualifiedPaths on a Linux host.
 *
 * Proton snapshots keep Windows-looking paths for adaptors while tagging
 * them with the Steam compatdata path:
 *
 *   windows://proton:%2Fhome%2Fme%2F...%2Fcompatdata%2F1091500///C/users/steamuser
 *
 * The tag lets the host map C: into the Wine prefix and Z: back to the
 * Linux root when an adaptor uses the filesystem service.
 */
export class ProtonWindowsPathResolverImpl implements PathResolver {
  readonly scheme = "windows" as const;
  readonly parent = null;

  async resolve(path: QualifiedPath): Promise<ResolvedPath> {
    if (path.scheme !== this.scheme) {
      throw new PathResolverError(`Unsupported scheme '${path.scheme}'`);
    }

    const compatDataPath = decodeProtonCompatDataPath(path.data);
    if (compatDataPath === undefined) {
      throw new PathResolverError(
        `Unsupported Windows path '${path.value}': missing Proton compatdata tag`,
      );
    }

    return resolveProtonWindowsPath(compatDataPath, path.path);
  }
}

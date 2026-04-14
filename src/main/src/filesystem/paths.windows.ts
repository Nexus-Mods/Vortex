import type {
  QualifiedPath,
  ResolvedPath,
  WindowsPathBase,
  WindowsPathProvider,
} from "@vortex/fs";

import {
  PathProviderError,
  PathResolverError,
  QualifiedPath as QP,
} from "@vortex/fs";
import { access } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { win32 as pathWin32 } from "node:path";

/**
 * Node-backed implementation of {@link WindowsPathProvider}.
 *
 * Paths under the `windows` scheme encode Windows native paths as a rooted
 * POSIX-style path where the drive letter is the first component:
 *
 *   native `C:\Users\alice\file.txt`  ⇔  `windows:///C/Users/alice/file.txt`
 *   native `C:\`                      ⇔  `windows:///C`
 *
 * The leading `/` enforces that paths are always rooted (no drive-relative
 * ambiguity), the drive letter is a single `[A-Za-z]` component, and the
 * remainder uses forward slashes so `QualifiedPath.join` / `parent` behave
 * naturally without platform-specific handling.
 *
 * UNC paths (`\\server\share`) and drive-relative paths (`C:foo` without a
 * separator) are out of scope and are rejected at the edge.
 */
export class WindowsPathProviderImpl implements WindowsPathProvider {
  readonly platform = "windows" as const;
  readonly scheme = "windows" as const;
  readonly parent = null;

  /**
   * Wraps a Windows native path as a `QualifiedPath` in the rooted
   * drive-letter encoding. Uses `path.win32.parse` to detect the root so
   * UNC / drive-relative inputs are rejected up-front rather than silently
   * producing a malformed `QualifiedPath`.
   */
  #create(nativePath: string): Promise<QualifiedPath> {
    const parsed = pathWin32.parse(nativePath);
    const root = parsed.root;
    const driveMatch = /^([A-Za-z]):[\\/]$/.exec(root);
    if (driveMatch === null) {
      return Promise.reject(
        new PathProviderError(
          `Unsupported Windows path '${nativePath}': only drive-letter absolute paths are handled (no UNC, no drive-relative)`,
        ),
      );
    }
    const drive = driveMatch[1].toUpperCase();
    const tail = nativePath.slice(root.length).replace(/\\/g, "/");
    const value =
      tail.length > 0
        ? `${this.scheme}:///${drive}/${tail}`
        : `${this.scheme}:///${drive}`;
    return Promise.resolve(QP.parse(value));
  }

  fromBase(base: WindowsPathBase): Promise<QualifiedPath> {
    if (base === "home") {
      const env = process.env["USERPROFILE"];
      return this.#create(env && env.length > 0 ? env : homedir());
    } else if (base === "temp") {
      return this.#create(tmpdir());
    }

    const exhausted: never = base;
    return Promise.reject(
      new PathProviderError(`Unknown base '${exhausted as string}'`),
    );
  }

  resolve(path: QualifiedPath): Promise<ResolvedPath> {
    if (path.scheme !== this.scheme) {
      return Promise.reject(
        new PathResolverError(`Unsupported scheme '${path.scheme}'`),
      );
    }
    const p = path.path;
    if (!p.startsWith("/")) {
      return Promise.reject(
        new PathResolverError(
          `Invalid windows path '${path.value}': must be rooted (leading '/')`,
        ),
      );
    }
    const rest = p.slice(1);
    const slash = rest.indexOf("/");
    const drive = slash === -1 ? rest : rest.slice(0, slash);
    if (!/^[A-Za-z]$/.test(drive)) {
      return Promise.reject(
        new PathResolverError(
          `Invalid windows path '${path.value}': first component must be a single drive letter`,
        ),
      );
    }
    const tail = slash === -1 ? "" : rest.slice(slash + 1);
    const native =
      tail.length > 0
        ? `${drive.toUpperCase()}:\\${tail.replace(/\//g, "\\")}`
        : `${drive.toUpperCase()}:\\`;
    return Promise.resolve(native);
  }

  async enumerateDrives(): Promise<QualifiedPath[]> {
    // Best-effort drive probe: stat each letter root and keep the ones that
    // exist. O(26) filesystem touches, fast enough for a one-shot query and
    // avoids pulling in platform-specific native modules.
    const letters: string[] = [];
    for (let c = 65; c <= 90; c++) letters.push(String.fromCharCode(c));

    const probes = await Promise.all(
      letters.map(async (letter) => {
        try {
          await access(`${letter}:\\`);
          return letter;
        } catch {
          return undefined;
        }
      }),
    );

    const drives: QualifiedPath[] = [];
    for (const letter of probes) {
      if (letter === undefined) continue;
      drives.push(await this.#create(`${letter}:\\`));
    }
    return drives;
  }
}

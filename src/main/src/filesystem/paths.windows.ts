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

/**
 * Node-backed implementation of {@link WindowsPathProvider}.
 *
 * Paths under the `windows` scheme carry native Windows paths with forward
 * slashes in the `QualifiedPath.path` component (e.g. the native path
 * `C:\\Users\\alice` round-trips through `windows://C:/Users/alice`). Slash
 * conversion happens at the edges: `resolve()` converts `/` → `\\` before
 * returning a native path, and path constructors normalise native `\\` → `/`
 * before building the `QualifiedPath`.
 *
 * Current scope is plain drive-letter absolute paths. UNC paths
 * (`\\\\server\\share`), `\\\\?\\`-prefixed long paths, and drive-relative
 * paths (`C:foo` without a separator) are not handled.
 */
export class WindowsPathProviderImpl implements WindowsPathProvider {
  readonly platform = "windows" as const;
  readonly scheme = "windows" as const;
  readonly parent = null;

  #create(nativePath: string): Promise<QualifiedPath> {
    const normalised = nativePath.replace(/\\/g, "/");
    return Promise.resolve(QP.parse(`${this.scheme}://${normalised}`));
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
    return Promise.resolve(path.path.replace(/\//g, "\\"));
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

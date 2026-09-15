import { access } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { win32 as pathWin32 } from "node:path";

import type { WindowsPathBase, WindowsPathProvider } from "@vortex/shared/filesystem";
import { PathProviderError, QualifiedPath } from "@vortex/shared/filesystem";

/**
 * Node-backed implementation of {@link WindowsPathProvider}.
 *
 * A pure factory: wraps well-known Windows locations as `native://`
 * {@link QualifiedPath}s via {@link QualifiedPath.fromNative}. It does not
 * resolve anything - decoding `native://` paths is the
 * {@link NativePathResolver}'s job.
 */
export class WindowsPathProviderImpl implements WindowsPathProvider {
  readonly platform = "windows" as const;

  fromBase(base: WindowsPathBase): Promise<QualifiedPath> {
    switch (base) {
      case "home":
        return Promise.resolve(QualifiedPath.fromNative(this.#home()));
      case "temp":
        return Promise.resolve(QualifiedPath.fromNative(tmpdir()));
      case "appData":
        return Promise.resolve(QualifiedPath.fromNative(pathWin32.join(this.#home(), "AppData")));
      case "documents":
        return Promise.resolve(QualifiedPath.fromNative(pathWin32.join(this.#home(), "Documents")));
      case "my games":
        return Promise.resolve(
          QualifiedPath.fromNative(pathWin32.join(this.#home(), "Documents", "My Games")),
        );
    }
    const exhausted: never = base;
    return Promise.reject(new PathProviderError(`Unknown base '${exhausted as string}'`));
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
      drives.push(QualifiedPath.fromNative(`${letter}:\\`));
    }
    return drives;
  }

  #home(): string {
    const env = process.env["USERPROFILE"];
    return env && env.length > 0 ? env : homedir();
  }
}

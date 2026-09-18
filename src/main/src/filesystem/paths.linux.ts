import { homedir, tmpdir } from "node:os";
import { join } from "node:path/posix";

import type { LinuxPathProvider, LinuxPathBase, XDGBase } from "@vortex/shared/filesystem";
import { QualifiedPath, PathProviderError, XDG } from "@vortex/shared/filesystem";

/**
 * Node-backed implementation of {@link LinuxPathProvider}.
 *
 * A pure factory: wraps well-known Linux locations (and the XDG Base
 * Directory specification) as `native://` {@link QualifiedPath}s via
 * {@link QualifiedPath.fromNative}. It does not resolve anything - decoding
 * `native://` paths is the {@link NativePathResolver}'s job.
 */
export class LinuxPathProviderImpl implements LinuxPathProvider {
  readonly platform = "linux" as const;

  #create(path: string): Promise<QualifiedPath> {
    return Promise.resolve(QualifiedPath.fromNative(path));
  }

  fromBase(base: LinuxPathBase): Promise<QualifiedPath> {
    if (base === "home") {
      return this.#create(homedir());
    } else if (base === "temp") {
      return this.#create(tmpdir());
    } else if (
      base === XDG.cache ||
      base === XDG.runtime ||
      base === XDG.data ||
      base === XDG.config ||
      base === XDG.state
    ) {
      return this.fromXDGBase(base);
    }

    const exhausted: never = base;
    return Promise.reject(new PathProviderError(`Unknown base '${exhausted as string}'`));
  }

  fromXDGBase(base: XDGBase): Promise<QualifiedPath> {
    // https://specifications.freedesktop.org/basedir/latest
    if (base === XDG.data) {
      return this.#getXDGBaseDirectory("XDG_DATA_HOME", ".local/share");
    } else if (base === XDG.cache) {
      return this.#getXDGBaseDirectory("XDG_CACHE_HOME", ".cache");
    } else if (base === XDG.config) {
      return this.#getXDGBaseDirectory("XDG_CONFIG_HOME", ".config");
    } else if (base === XDG.state) {
      return this.#getXDGBaseDirectory("XDG_STATE_HOME", ".local/state");
    } else if (base === XDG.runtime) {
      const envValue = process.env["XDG_RUNTIME_DIR"];
      if (envValue) return this.#create(envValue);
      return this.#create(tmpdir());
    }

    const exhausted: never = base;
    return Promise.reject(new PathProviderError(`Unknown base '${exhausted as string}'`));
  }

  #getXDGBaseDirectory(envName: string, relative: string): Promise<QualifiedPath> {
    const envValue = process.env[envName];
    if (envValue) return this.#create(envValue);

    const value = join(homedir(), relative);
    return this.#create(value);
  }
}

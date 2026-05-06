import type {
  ResolvedPath,
  LinuxPathProvider,
  LinuxPathBase,
  XDGBase,
} from "@nexusmods/adaptor-api/fs";

import {
  QualifiedPath,
  PathResolverError,
  PathProviderError,
  XDG,
} from "@nexusmods/adaptor-api/fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path/posix";

export class LinuxPathProviderImpl implements LinuxPathProvider {
  readonly platform = "linux" as const;
  readonly scheme = "linux" as const;
  readonly parent = null;

  #create(path: string): Promise<QualifiedPath> {
    return Promise.resolve(QualifiedPath.parse(`${this.scheme}://${path}`));
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
    return Promise.reject(
      new PathProviderError(`Unknown base '${exhausted as string}'`),
    );
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
    return Promise.reject(
      new PathProviderError(`Unknown base '${exhausted as string}'`),
    );
  }

  #getXDGBaseDirectory(
    envName: string,
    relative: string,
  ): Promise<QualifiedPath> {
    const envValue = process.env[envName];
    if (envValue) return this.#create(envValue);

    const value = join(homedir(), relative);
    return this.#create(value);
  }

  resolve(path: QualifiedPath): Promise<ResolvedPath> {
    if (path.scheme !== this.scheme)
      return Promise.reject(
        new PathResolverError(`Unsupported scheme '${path.scheme}'`),
      );
    return Promise.resolve(path.path);
  }
}

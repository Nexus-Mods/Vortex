import type { IVortexPathProvider, VortexPathBase } from "@vortex/shared/filesystem";
import { QualifiedPath } from "@vortex/shared/filesystem";

import { getVortexPath } from "../getVortexPath";

/**
 * Main-process implementation of {@link IVortexPathProvider}, backed by
 * {@link getVortexPath}.
 */
export class VortexPathProvider implements IVortexPathProvider {
  static readonly instance = new VortexPathProvider();

  fromBase(base: VortexPathBase): Promise<QualifiedPath> {
    return Promise.resolve(QualifiedPath.fromNative(getVortexPath(base)));
  }
}

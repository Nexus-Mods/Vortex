import type { IVortexPathProvider, VortexPathBase } from "@vortex/shared/filesystem";
import { QualifiedPath } from "@vortex/shared/filesystem";

import { ApplicationData } from "../applicationData";

/**
 * Renderer implementation of {@link IVortexPathProvider}, backed by the
 * application data snapshot handed over at startup.
 */
export class VortexPathProvider implements IVortexPathProvider {
  static readonly instance = new VortexPathProvider();

  async fromBase(base: VortexPathBase): Promise<QualifiedPath> {
    return QualifiedPath.fromNative(ApplicationData.instance.paths[base]);
  }
}

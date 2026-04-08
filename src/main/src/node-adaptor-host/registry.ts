import type { IAdaptorManifest, PID, URI } from "@vortex/adaptor-api";

// --- Name Service (URI → PID resolution) ---

/**
 * Maps service URIs to the PID of the adaptor that provides them.
 * Used for routing messages to the correct adaptor instance.
 */
export class NameService {
  private names = new Map<URI, PID>();

  register(name: URI, pid: PID): void {
    this.names.set(name, pid);
  }

  resolve(name: URI): PID | undefined {
    return this.names.get(name);
  }

  unregister(name: URI): void {
    this.names.delete(name);
  }
}

// --- Adaptor Registry ---

/**
 * A registered adaptor entry in the AdaptorRegistry.
 */
export interface IRegisteredAdaptor {
  pid: PID;
  manifest: IAdaptorManifest;
}

/**
 * Tracks all loaded adaptors by PID. Stores manifests for introspection
 * and lifecycle management.
 */
export class AdaptorRegistry {
  private adaptors = new Map<PID, IRegisteredAdaptor>();

  register(pid: PID, manifest: IAdaptorManifest): void {
    this.adaptors.set(pid, { pid, manifest });
  }

  get(pid: PID): IRegisteredAdaptor | undefined {
    return this.adaptors.get(pid);
  }

  list(): IRegisteredAdaptor[] {
    return [...this.adaptors.values()];
  }

  unregister(pid: PID): void {
    this.adaptors.delete(pid);
  }
}

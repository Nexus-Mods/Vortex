declare global {
  // eslint-disable-next-line no-var
  var __vortex_service_container: Map<string, unknown> | undefined;
}

/**
 * Returns an accessor for the service container.
 * The container is set on `globalThis.__vortex_service_container` by the
 * bootstrapper before the adaptor bundle is evaluated — the API package
 * itself does not own or manage this state.
 */
export function getContainer(): { resolve(uri: string): unknown } {
  return {
    resolve(uri: string): unknown {
      const container = globalThis.__vortex_service_container;
      if (!container) {
        throw new Error(
          "Service container not initialized — the bootstrapper must set globalThis.__vortex_service_container before evaluation",
        );
      }
      const svc = container.get(uri);
      if (!svc) {
        throw new Error(`Service not found: ${uri}`);
      }
      return svc;
    },
  };
}

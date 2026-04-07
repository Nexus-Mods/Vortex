let activeContainer: Map<string, unknown> | null = null;

/**
 * Creates an empty service container.
 * Populate it with service proxies before passing to {@link activateContainer}.
 */
export function createContainer(): Map<string, unknown> {
  return new Map();
}

/**
 * Sets the given container as the active global container.
 * Must be called before any `virtual:services` imports resolve.
 *
 * @param container - A populated service container to activate.
 */
export function activateContainer(container: Map<string, unknown>): void {
  activeContainer = container;
}

/**
 * Clears the active container.
 * Services resolved before this call remain usable via their captured references.
 */
export function deactivateContainer(): void {
  activeContainer = null;
}

/**
 * Returns an accessor for the active container.
 * Resolution is lazy — it reads from whatever container is active at call time,
 * not at the time {@link getContainer} itself was called.
 */
export function getContainer(): { resolve(uri: string): unknown } {
  return {
    resolve(uri: string): unknown {
      if (!activeContainer) {
        throw new Error("Service container not initialized — services can only be used after activation");
      }
      const svc = activeContainer.get(uri);
      if (!svc) {
        throw new Error(`Service not found: ${uri}`);
      }
      return svc;
    },
  };
}

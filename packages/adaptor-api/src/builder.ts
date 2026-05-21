import type { URI } from "./types/branded";
import { uri as validateUri } from "./types/branded";

type Constructor = new (...args: unknown[]) => unknown;

const PROVIDES_METADATA = new Map<Constructor, URI>();

/**
 * Decorator that marks a class as providing a service at the given URI.
 * The host scans for these registrations after importing an adaptor module.
 * Validates the URI format at decoration time.
 *
 * @param serviceUri - The service URI this class will handle.
 *
 * @example
 * ```ts
 * @provides("vortex:adaptor/ping-test/echo")
 * class EchoService implements IEchoService {
 *   async echo(data: string) { return `echo: ${data}`; }
 * }
 * ```
 */
export function provides(serviceUri: string) {
  const branded = validateUri(serviceUri);
  return function <T extends Constructor>(target: T): T {
    PROVIDES_METADATA.set(target, branded);
    return target;
  };
}

/**
 * Returns the URI a class was decorated with via {@link provides}, or undefined
 * if the class was not decorated.
 *
 * @param target - The class constructor to look up.
 */
export function getProvidedUri(target: Constructor): URI | undefined {
  return PROVIDES_METADATA.get(target);
}

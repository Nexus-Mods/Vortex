// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor = new (...args: any[]) => any;

const PROVIDES_METADATA = new Map<Constructor, string>();

/**
 * Decorator that marks a class as providing a service at the given URI.
 * The host scans for these registrations after importing an adaptor module.
 *
 * @param uri - The service URI this class will handle.
 *
 * @example
 * ```ts
 * @provides("vortex:adaptor/ping-test/echo")
 * class EchoService implements IEchoService {
 *   async echo(data: string) { return `echo: ${data}`; }
 * }
 * ```
 */
export function provides(uri: string) {
  return function <T extends Constructor>(target: T): T {
    PROVIDES_METADATA.set(target, uri);
    return target;
  };
}

/**
 * Returns the URI a class was decorated with via {@link provides}, or undefined
 * if the class was not decorated.
 *
 * @param target - The class constructor to look up.
 */
export function getProvidedUri(target: Constructor): string | undefined {
  return PROVIDES_METADATA.get(target);
}

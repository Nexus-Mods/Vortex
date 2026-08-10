import type { Delays as GotTimeoutOptions } from "got";

export type TimeoutOptions = {
  // TODO: use Temporal API
  /** Timeout for DNS lookup (ms). */
  lookup: number;

  /** Timeout for DNS lookup + TCP connect + TLS handshake (ms). */
  connect: number;

  /** Timeout between received data packets before treating the connection as stalled (ms). */
  stall: number;
};

export function createGotTimeoutOptions(timeout?: TimeoutOptions): GotTimeoutOptions | undefined {
  if (!timeout) return undefined;

  return {
    lookup: timeout.lookup,
    connect: timeout.connect,
    secureConnect: timeout.connect,
    socket: timeout.stall,
    response: timeout.stall,
  };
}

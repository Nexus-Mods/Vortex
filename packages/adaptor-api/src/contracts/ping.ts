/**
 * Host-provided ping service.
 * Used for health checks and echo testing.
 */
export interface IPingService {
  ping(data: string): Promise<string>;
  health(): Promise<{ status: "ok" | "degraded" }>;
}

/**
 * Adaptor-provided echo service.
 * Wraps a ping call with an `'echo: '` prefix.
 */
export interface IEchoService {
  echo(data: string): Promise<string>;
}

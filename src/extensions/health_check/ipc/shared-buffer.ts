import type { IHealthCheckResult } from "../../../types/IHealthCheck";
import { SharedBuffer, type ISharedBufferStats } from "./SharedBuffer";

const DEFAULT_SIZE = 50 * 1024 * 1024; // 50MB default for health check results

/**
 * Shared memory buffer for high-throughput health check results.
 * Handles large datasets (>10MB) without IPC serialization overhead.
 *
 * This is a specialized wrapper around SharedBuffer for health check results.
 */
export class HealthCheckSharedBuffer {
  private mBuffer: SharedBuffer;

  constructor() {
    this.mBuffer = new SharedBuffer("HealthCheckSharedBuffer");
  }

  /**
   * Initialize the shared buffer
   * Must be called from main process first, then buffer is passed to renderer
   */
  public initialize(sizeInBytes: number = DEFAULT_SIZE): SharedArrayBuffer {
    return this.mBuffer.initialize(sizeInBytes);
  }

  /**
   * Attach to an existing shared buffer (called from renderer)
   */
  public attach(buffer: SharedArrayBuffer): void {
    this.mBuffer.attach(buffer);
  }

  /**
   * Write health check results to shared buffer
   * Called from main process
   */
  public writeResults(results: IHealthCheckResult[]): boolean {
    return this.mBuffer.write(results);
  }

  /**
   * Read health check results from shared buffer
   * Called from renderer process
   */
  public readResults(): IHealthCheckResult[] | null {
    const results = this.mBuffer.read<IHealthCheckResult[]>();
    // Return empty array instead of null for "no data yet" case
    return results ?? [];
  }

  /**
   * Wait for new data with timeout
   * Uses Atomics.wait for efficient blocking
   */
  public waitForUpdate(timeoutMs: number = 5000): number {
    return this.mBuffer.waitForUpdate(timeoutMs);
  }

  /**
   * Get current version (for polling)
   */
  public getVersion(): number {
    return this.mBuffer.getVersion();
  }

  /**
   * Get buffer statistics
   */
  public getStats(): ISharedBufferStats | null {
    return this.mBuffer.getStats();
  }

  /**
   * Clear the buffer
   */
  public clear(): void {
    this.mBuffer.clear();
  }
}

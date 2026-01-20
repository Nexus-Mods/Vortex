import type { IHealthCheckResult } from "../../../types/IHealthCheck";
import { log } from "../../../util/log";

/**
 * Shared memory buffer for high-throughput health check results
 * Handles large datasets (>10MB) without IPC serialization overhead
 */
export class HealthCheckSharedBuffer {
  private static HEADER_SIZE = 16; // bytes for metadata
  private static DEFAULT_SIZE = 50 * 1024 * 1024; // 50MB default

  private mBuffer: SharedArrayBuffer | null = null;
  private mHeaderView: DataView | null = null;
  private mDataView: Uint8Array | null = null;

  /**
   * Initialize the shared buffer
   * Must be called from main process first, then buffer is passed to renderer
   */
  public initialize(
    sizeInBytes: number = HealthCheckSharedBuffer.DEFAULT_SIZE,
  ): SharedArrayBuffer {
    this.mBuffer = new SharedArrayBuffer(sizeInBytes);
    this.mHeaderView = new DataView(
      this.mBuffer,
      0,
      HealthCheckSharedBuffer.HEADER_SIZE,
    );
    this.mDataView = new Uint8Array(
      this.mBuffer,
      HealthCheckSharedBuffer.HEADER_SIZE,
    );

    // Initialize header
    // [0-3]: Data length (uint32)
    // [4-7]: Version/sequence number (uint32)
    // [8-11]: Checksum (uint32)
    // [12-15]: Reserved (uint32)
    this.mHeaderView.setUint32(0, 0); // length = 0
    this.mHeaderView.setUint32(4, 0); // version = 0
    this.mHeaderView.setUint32(8, 0); // checksum = 0
    this.mHeaderView.setUint32(12, 0); // reserved = 0

    log("debug", "SharedArrayBuffer initialized", { size: sizeInBytes });

    return this.mBuffer;
  }

  /**
   * Attach to an existing shared buffer (called from renderer)
   */
  public attach(buffer: SharedArrayBuffer): void {
    this.mBuffer = buffer;
    this.mHeaderView = new DataView(
      buffer,
      0,
      HealthCheckSharedBuffer.HEADER_SIZE,
    );
    this.mDataView = new Uint8Array(
      buffer,
      HealthCheckSharedBuffer.HEADER_SIZE,
    );

    log("debug", "Attached to SharedArrayBuffer", { size: buffer.byteLength });
  }

  /**
   * Write health check results to shared buffer
   * Called from main process
   */
  public writeResults(results: IHealthCheckResult[]): boolean {
    if (!this.mBuffer || !this.mHeaderView || !this.mDataView) {
      log("error", "Cannot write: SharedArrayBuffer not initialized");
      return false;
    }

    try {
      // Serialize to JSON
      const json = JSON.stringify(results);
      const encoder = new TextEncoder();
      const encoded = encoder.encode(json);

      // Check if data fits
      const availableSpace = this.mDataView.length;
      if (encoded.length > availableSpace) {
        log("error", "Data too large for SharedArrayBuffer", {
          dataSize: encoded.length,
          bufferSize: availableSpace,
        });
        return false;
      }

      // Calculate simple checksum (sum of bytes)
      let checksum = 0;
      for (let i = 0; i < encoded.length; i++) {
        checksum = (checksum + encoded[i]) & 0xffffffff;
      }

      // Atomic write sequence:
      // 1. Write data
      this.mDataView.set(encoded);

      // 2. Update metadata atomically
      const currentVersion = this.mHeaderView.getUint32(4);
      Atomics.store(new Uint32Array(this.mBuffer, 8, 1), 0, checksum); // checksum
      Atomics.store(new Uint32Array(this.mBuffer, 0, 1), 0, encoded.length); // length
      Atomics.store(new Uint32Array(this.mBuffer, 4, 1), 0, currentVersion + 1); // increment version

      // 3. Notify waiting threads (if any)
      Atomics.notify(new Int32Array(this.mBuffer, 4, 1), 0);

      log("debug", "Wrote results to SharedArrayBuffer", {
        resultCount: results.length,
        dataSize: encoded.length,
        version: currentVersion + 1,
      });

      return true;
    } catch (error) {
      log("error", "Failed to write results to SharedArrayBuffer", error);
      return false;
    }
  }

  /**
   * Read health check results from shared buffer
   * Called from renderer process
   */
  public readResults(): IHealthCheckResult[] | null {
    if (!this.mBuffer || !this.mHeaderView || !this.mDataView) {
      log("error", "Cannot read: SharedArrayBuffer not attached");
      return null;
    }

    try {
      // Atomic read sequence
      const length = Atomics.load(new Uint32Array(this.mBuffer, 0, 1), 0);
      const version = Atomics.load(new Uint32Array(this.mBuffer, 4, 1), 0);
      const storedChecksum = Atomics.load(
        new Uint32Array(this.mBuffer, 8, 1),
        0,
      );

      if (length === 0) {
        // No data written yet
        return [];
      }

      if (length > this.mDataView.length) {
        log("error", "Corrupted buffer: length exceeds buffer size", {
          length,
        });
        return null;
      }

      // Read data
      const data = this.mDataView.slice(0, length);

      // Verify checksum
      let checksum = 0;
      for (let i = 0; i < data.length; i++) {
        checksum = (checksum + data[i]) & 0xffffffff;
      }

      if (checksum !== storedChecksum) {
        log("warn", "Checksum mismatch - data may be corrupted", {
          expected: storedChecksum,
          actual: checksum,
        });
        // Continue anyway - data might still be usable
      }

      // Decode
      const decoder = new TextDecoder();
      const json = decoder.decode(data);
      const results = JSON.parse(json) as IHealthCheckResult[];

      log("debug", "Read results from SharedArrayBuffer", {
        resultCount: results.length,
        version,
      });

      return results;
    } catch (error) {
      log("error", "Failed to read results from SharedArrayBuffer", error);
      return null;
    }
  }

  /**
   * Wait for new data with timeout
   * Uses Atomics.wait for efficient blocking
   */
  public async waitForUpdate(timeoutMs: number = 5000): Promise<number> {
    if (!this.mBuffer) {
      return -1;
    }

    const currentVersion = Atomics.load(new Uint32Array(this.mBuffer, 4, 1), 0);

    // Wait for version to change
    const result = Atomics.wait(
      new Int32Array(this.mBuffer, 4, 1),
      0,
      currentVersion,
      timeoutMs,
    );

    if (result === "ok") {
      // Version changed
      return Atomics.load(new Uint32Array(this.mBuffer, 4, 1), 0);
    } else if (result === "timed-out") {
      return -1;
    } else {
      // 'not-equal' - version already changed
      return Atomics.load(new Uint32Array(this.mBuffer, 4, 1), 0);
    }
  }

  /**
   * Get current version (for polling)
   */
  public getVersion(): number {
    if (!this.mBuffer || !this.mHeaderView) {
      return -1;
    }

    return Atomics.load(new Uint32Array(this.mBuffer, 4, 1), 0);
  }

  /**
   * Get buffer statistics
   */
  public getStats(): {
    totalSize: number;
    dataSize: number;
    utilization: number;
  } | null {
    if (!this.mBuffer || !this.mHeaderView) {
      return null;
    }

    const length = Atomics.load(new Uint32Array(this.mBuffer, 0, 1), 0);
    const totalSize =
      this.mBuffer.byteLength - HealthCheckSharedBuffer.HEADER_SIZE;

    return {
      totalSize,
      dataSize: length,
      utilization: totalSize > 0 ? (length / totalSize) * 100 : 0,
    };
  }

  /**
   * Clear the buffer
   */
  public clear(): void {
    if (!this.mBuffer || !this.mHeaderView) {
      return;
    }

    Atomics.store(new Uint32Array(this.mBuffer, 0, 1), 0, 0); // length = 0
    Atomics.notify(new Int32Array(this.mBuffer, 4, 1), 0);

    log("debug", "Cleared SharedArrayBuffer");
  }
}

import { log } from "../../../util/log";

/**
 * Header layout (16 bytes):
 * [0-3]: Data length (uint32)
 * [4-7]: Version/sequence number (uint32)
 * [8-11]: Checksum (uint32)
 * [12-15]: Reserved (uint32)
 */
const HEADER_SIZE = 16;
const DEFAULT_SIZE = 10 * 1024 * 1024; // 10MB default

export interface ISharedBufferStats {
  totalSize: number;
  dataSize: number;
  utilization: number;
}

/**
 * Generic SharedArrayBuffer wrapper for efficient IPC data transfer.
 * Handles large datasets without serialization overhead by using shared memory.
 *
 * Features:
 * - Atomic read/write operations for thread safety
 * - Checksum verification for data integrity
 * - Version tracking for change detection
 * - JSON serialization/deserialization
 */
export class SharedBuffer {
  private mBuffer: SharedArrayBuffer | null = null;
  private mHeaderView: DataView | null = null;
  private mDataView: Uint8Array | null = null;
  private mName: string;

  constructor(name: string = "SharedBuffer") {
    this.mName = name;
  }

  /**
   * Initialize a new shared buffer (call from main process)
   */
  public initialize(sizeInBytes: number = DEFAULT_SIZE): SharedArrayBuffer {
    this.mBuffer = new SharedArrayBuffer(sizeInBytes);
    this.mHeaderView = new DataView(this.mBuffer, 0, HEADER_SIZE);
    this.mDataView = new Uint8Array(this.mBuffer, HEADER_SIZE);

    // Initialize header
    this.mHeaderView.setUint32(0, 0); // length = 0
    this.mHeaderView.setUint32(4, 0); // version = 0
    this.mHeaderView.setUint32(8, 0); // checksum = 0
    this.mHeaderView.setUint32(12, 0); // reserved = 0

    log("debug", `${this.mName} initialized`, { size: sizeInBytes });

    return this.mBuffer;
  }

  /**
   * Attach to an existing shared buffer (call from renderer process)
   */
  public attach(buffer: SharedArrayBuffer): void {
    this.mBuffer = buffer;
    this.mHeaderView = new DataView(buffer, 0, HEADER_SIZE);
    this.mDataView = new Uint8Array(buffer, HEADER_SIZE);

    log("debug", `${this.mName} attached`, { size: buffer.byteLength });
  }

  /**
   * Check if buffer is initialized or attached
   */
  public isReady(): boolean {
    return (
      this.mBuffer !== null &&
      this.mHeaderView !== null &&
      this.mDataView !== null
    );
  }

  /**
   * Get the underlying SharedArrayBuffer
   */
  public getBuffer(): SharedArrayBuffer | null {
    return this.mBuffer;
  }

  /**
   * Write data to the shared buffer
   */
  public write<T>(data: T): boolean {
    if (!this.mBuffer || !this.mHeaderView || !this.mDataView) {
      log("error", `Cannot write: ${this.mName} not initialized`);
      return false;
    }

    try {
      // Serialize to JSON
      const json = JSON.stringify(data);
      const encoder = new TextEncoder();
      const encoded = encoder.encode(json);

      // Check if data fits
      const availableSpace = this.mDataView.length;
      if (encoded.length > availableSpace) {
        log("error", `Data too large for ${this.mName}`, {
          dataSize: encoded.length,
          bufferSize: availableSpace,
        });
        return false;
      }

      // Calculate checksum (sum of bytes)
      const checksum = this.calculateChecksum(encoded);

      // Atomic write sequence:
      // 1. Write data
      this.mDataView.set(encoded);

      // 2. Update metadata atomically
      const currentVersion = this.mHeaderView.getUint32(4);
      Atomics.store(new Uint32Array(this.mBuffer, 8, 1), 0, checksum); // checksum
      Atomics.store(new Uint32Array(this.mBuffer, 0, 1), 0, encoded.length); // length
      Atomics.store(new Uint32Array(this.mBuffer, 4, 1), 0, currentVersion + 1); // version

      // 3. Notify waiting threads
      Atomics.notify(new Int32Array(this.mBuffer, 4, 1), 0);

      log("debug", `${this.mName}: wrote data`, {
        dataSize: encoded.length,
        version: currentVersion + 1,
      });

      return true;
    } catch (error) {
      log("error", `Failed to write to ${this.mName}`, error);
      return false;
    }
  }

  /**
   * Read data from the shared buffer
   */
  public read<T>(): T | null {
    if (!this.mBuffer || !this.mHeaderView || !this.mDataView) {
      log("error", `Cannot read: ${this.mName} not attached`);
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
        return null;
      }

      if (length > this.mDataView.length) {
        log("error", `Corrupted ${this.mName}: length exceeds buffer size`, {
          length,
        });
        return null;
      }

      // Read data
      const data = this.mDataView.slice(0, length);

      // Verify checksum
      const checksum = this.calculateChecksum(data);
      if (checksum !== storedChecksum) {
        log(
          "warn",
          `${this.mName}: checksum mismatch - data may be corrupted`,
          {
            expected: storedChecksum,
            actual: checksum,
          },
        );
        // Continue anyway - data might still be usable
      }

      // Decode
      const decoder = new TextDecoder();
      const json = decoder.decode(data);
      const result = JSON.parse(json) as T;

      log("debug", `${this.mName}: read data`, {
        dataSize: length,
        version,
      });

      return result;
    } catch (error) {
      log("error", `Failed to read from ${this.mName}`, error);
      return null;
    }
  }

  /**
   * Wait for data update with timeout
   * Uses Atomics.wait for efficient blocking
   */
  public waitForUpdate(timeoutMs: number = 5000): number {
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

    if (result === "ok" || result === "not-equal") {
      // Version changed
      return Atomics.load(new Uint32Array(this.mBuffer, 4, 1), 0);
    }

    // Timed out
    return -1;
  }

  /**
   * Get current version (for polling)
   */
  public getVersion(): number {
    if (!this.mBuffer) {
      return -1;
    }

    return Atomics.load(new Uint32Array(this.mBuffer, 4, 1), 0);
  }

  /**
   * Get buffer statistics
   */
  public getStats(): ISharedBufferStats | null {
    if (!this.mBuffer || !this.mHeaderView) {
      return null;
    }

    const length = Atomics.load(new Uint32Array(this.mBuffer, 0, 1), 0);
    const totalSize = this.mBuffer.byteLength - HEADER_SIZE;

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
    if (!this.mBuffer) {
      return;
    }

    Atomics.store(new Uint32Array(this.mBuffer, 0, 1), 0, 0); // length = 0
    Atomics.notify(new Int32Array(this.mBuffer, 4, 1), 0);

    log("debug", `${this.mName} cleared`);
  }

  /**
   * Calculate checksum for data integrity verification
   */
  private calculateChecksum(data: Uint8Array): number {
    let checksum = 0;
    for (let i = 0; i < data.length; i++) {
      checksum = (checksum + data[i]) & 0xffffffff;
    }
    return checksum;
  }
}

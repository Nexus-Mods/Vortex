import { IChunk } from "./IChunk";
import { IDownloadOptions } from "./IDownload";

import Promise from "bluebird";

/**
 * Represents a download job with precise semantics for chunk positioning and progress tracking.
 *
 * Field Semantics:
 *
 * IMMUTABLE FIELDS (set at job creation, never mutated):
 * - confirmedOffset: Starting byte offset for this chunk in the file (immutable)
 * - confirmedSize: Total size of this chunk in bytes (immutable)
 *
 * CONFIRMED PROGRESS FIELDS (only updated on successful buffer write):
 * - confirmedReceived: Bytes successfully written to disk (starts at 0, increments on write confirmation)
 *                      Only decrements when restarting a chunk (reset to 0)
 *
 * OPTIMISTIC FIELDS (updated immediately without waiting for write confirmation):
 * - offset: Current write position (optimistically advanced, corrected on write confirmation)
 *           Initially = confirmedOffset + confirmedReceived
 *           Advanced optimistically on each write to prevent duplicate writes
 *           Recalculated from confirmed values on write completion
 * - size: Remaining bytes to download (optimistically reduced, corrected on write confirmation)
 *         Initially = confirmedSize - confirmedReceived
 *         Reduced optimistically on each write
 *         Recalculated from confirmed values on write completion
 * - received: Total bytes received for this chunk (optimistic, includes in-flight writes)
 *
 * Example lifecycle:
 * 1. Job created: confirmedOffset=0, confirmedSize=1MB, confirmedReceived=0
 *    Initial: offset=0, size=1MB, received=0
 * 2. Write 100KB buffer (optimistic update): offset=100KB, size=900KB, received=100KB
 * 3. Write confirms: confirmedReceived=100KB, offset recalculated to 100KB ✓
 * 4. On chunk restart: confirmedReceived=0 (reset)
 *    Recalculated: offset=0 (back to confirmedOffset), size=1MB, received=0
 */
export interface IDownloadJob extends IChunk {
  state: "init" | "running" | "paused" | "finished";
  workerId?: number;
  options: IDownloadOptions;

  /** Bytes successfully written to disk for this chunk (starts at 0, only increments on write confirmation) */
  confirmedReceived: number;

  /** Starting byte offset for this chunk in the file (immutable once set) */
  confirmedOffset: number;

  /** Total size of this chunk in bytes (immutable once set) */
  confirmedSize: number;

  extraCookies: string[];

  dataCB?: (offset: number, data) => Promise<boolean>;
  completionCB?: () => void;
  errorCB?: (err) => void;
  responseCB?: (size: number, fileName: string, chunkable: boolean) => void;
}

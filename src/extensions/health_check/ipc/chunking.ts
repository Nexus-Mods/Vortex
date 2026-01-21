/**
 * Data chunking utilities for IPC communication
 * Shared between main and renderer processes
 */

import { log } from "../../../util/log";

/** Default chunk size: 2MB */
export const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024;

/** Threshold for chunking: 1MB */
export const CHUNK_THRESHOLD = 1 * 1024 * 1024;

export interface ChunkedResponse {
  chunked: true;
  totalChunks: number;
  chunkIndex: number;
  data: string;
  checksum: number;
}

export interface ChunkedMetadata {
  chunked: true;
  totalChunks: number;
  totalSize: number;
}

export function isChunkedResponse(value: unknown): value is ChunkedResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "chunked" in value &&
    (value as ChunkedResponse).chunked === true &&
    "data" in value
  );
}

export function isChunkedMetadata(value: unknown): value is ChunkedMetadata {
  return (
    typeof value === "object" &&
    value !== null &&
    "chunked" in value &&
    (value as ChunkedMetadata).chunked === true &&
    "totalChunks" in value &&
    !("data" in value)
  );
}

/**
 * Simple checksum for data integrity
 */
export function simpleChecksum(data: string): number {
  let checksum = 0;
  for (let i = 0; i < data.length; i++) {
    checksum = (checksum + data.charCodeAt(i)) & 0xffffffff;
  }
  return checksum;
}

/**
 * Chunk large data for IPC transfer
 * @param data - Data to chunk
 * @param chunkSize - Maximum size per chunk in bytes
 * @returns Array of chunk objects
 */
export function chunkData(
  data: unknown,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): ChunkedResponse[] {
  const json = JSON.stringify(data);
  const totalSize = json.length;

  if (totalSize <= chunkSize) {
    return [
      {
        chunked: true,
        totalChunks: 1,
        chunkIndex: 0,
        data: json,
        checksum: simpleChecksum(json),
      },
    ];
  }

  const chunks: ChunkedResponse[] = [];
  const totalChunks = Math.ceil(totalSize / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, totalSize);
    const chunkData = json.slice(start, end);

    chunks.push({
      chunked: true,
      totalChunks,
      chunkIndex: i,
      data: chunkData,
      checksum: simpleChecksum(chunkData),
    });
  }

  log("debug", "Data chunked for IPC transfer", {
    totalSize,
    chunkSize,
    totalChunks,
  });

  return chunks;
}

/**
 * Reassemble chunked data
 * @param chunks - Array of received chunks
 * @returns Reassembled data or null if invalid
 */
export function reassembleChunks<T>(chunks: ChunkedResponse[]): T | null {
  if (chunks.length === 0) {
    return null;
  }

  // Sort by chunk index
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);

  // Validate we have all chunks
  const expectedCount = sorted[0].totalChunks;
  if (sorted.length !== expectedCount) {
    log("error", "Missing chunks during reassembly", {
      expected: expectedCount,
      received: sorted.length,
    });
    return null;
  }

  // Validate checksums and reassemble
  let json = "";
  for (const chunk of sorted) {
    const calculatedChecksum = simpleChecksum(chunk.data);
    if (calculatedChecksum !== chunk.checksum) {
      log("error", "Chunk checksum mismatch", {
        chunkIndex: chunk.chunkIndex,
        expected: chunk.checksum,
        calculated: calculatedChecksum,
      });
      return null;
    }
    json += chunk.data;
  }

  try {
    return JSON.parse(json) as T;
  } catch (error) {
    log("error", "Failed to parse reassembled chunks", error);
    return null;
  }
}

/**
 * Check if data size exceeds threshold for chunking
 */
export function shouldChunk(
  data: unknown,
  threshold: number = CHUNK_THRESHOLD,
): boolean {
  const json = JSON.stringify(data);
  return json.length > threshold;
}

/**
 * Get estimated size of data in bytes
 */
export function estimateSize(data: unknown): number {
  return JSON.stringify(data).length;
}

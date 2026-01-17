/**
 * ArchiveExtractor - Handles archive extraction with retry logic.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This class encapsulates:
 * - 7z extraction operations
 * - Retry logic for file-in-use errors
 * - Error classification and handling
 */

import Bluebird from "bluebird";
import * as path from "path";
import Zip from "node-7z";

import { log } from "../../../util/log";
import { ArchiveBrokenError } from "../../../util/CustomErrors";
import { isFileInUse, isCritical, classifyError } from "./errors";
import type {
  IExtractionResult,
  IExtractionOptions,
  IArchiveExtractorConfig,
  ExtractionProgressCallback,
  PasswordQueryCallback,
} from "./types/IArchiveExtractor";
import { DEFAULT_EXTRACTOR_CONFIG, FILETYPES_AVOID } from "./types";

/**
 * Handles archive extraction with automatic retry for transient errors.
 *
 * Uses 7z via node-7z for extraction. Implements retry logic for
 * "file in use" errors which are common during Windows installations.
 */
export class ArchiveExtractor {
  private mConfig: IArchiveExtractorConfig;
  private mZip: Zip;

  /**
   * Create a new ArchiveExtractor.
   * @param zip - The Zip instance to use for extraction (node-7z)
   * @param config - Optional configuration overrides
   */
  constructor(zip: Zip, config?: Partial<IArchiveExtractorConfig>) {
    this.mZip = zip;
    this.mConfig = { ...DEFAULT_EXTRACTOR_CONFIG, ...config };
  }

  /**
   * Extract an archive to the specified destination.
   *
   * @param archivePath - Path to the archive file
   * @param destPath - Destination directory for extracted files
   * @param options - Extraction options
   * @returns Promise resolving to extraction result
   * @throws ArchiveBrokenError if the archive is corrupt or unsupported
   */
  public extract(
    archivePath: string,
    destPath: string,
    options: IExtractionOptions = {},
  ): Bluebird<IExtractionResult> {
    const startTime = Date.now();
    const maxRetries = options.maxRetries ?? this.mConfig.defaultMaxRetries;
    const retryDelayMs =
      options.retryDelayMs ?? this.mConfig.defaultRetryDelayMs;

    // Check for avoided file types (e.g., .dll)
    const ext = path.extname(archivePath).toLowerCase();
    if (FILETYPES_AVOID.includes(ext)) {
      return Bluebird.reject(
        new ArchiveBrokenError(
          path.basename(archivePath),
          "file type on avoidlist",
        ),
      );
    }

    log("debug", "Starting archive extraction", {
      archivePath: path.basename(archivePath),
      destPath,
      maxRetries,
    });

    return this.extractWithRetry(
      archivePath,
      destPath,
      maxRetries,
      retryDelayMs,
      options.onProgress,
      options.queryPassword,
    ).then((result) => ({
      ...result,
      durationMs: Date.now() - startTime,
    }));
  }

  /**
   * Extract with automatic retry for transient errors.
   */
  private extractWithRetry(
    archivePath: string,
    destPath: string,
    maxRetries: number,
    retryDelayMs: number,
    onProgress?: ExtractionProgressCallback,
    queryPassword?: PasswordQueryCallback,
  ): Bluebird<{ code: number; errors: string[] }> {
    const attemptExtract = (
      retriesLeft: number,
    ): Bluebird<{ code: number; errors: string[] }> => {
      return this.mZip
        .extractFull(
          archivePath,
          destPath,
          { ssc: false },
          onProgress,
          queryPassword as any,
        )
        .catch((err: Error) => {
          const errorMsg = err.message || String(err);
          const severity = classifyError(errorMsg);

          if (
            severity === "retryable" &&
            isFileInUse(errorMsg) &&
            retriesLeft > 0
          ) {
            log("info", "Archive file in use, retrying extraction", {
              archivePath: path.basename(archivePath),
              retriesLeft,
              retryDelayMs,
            });
            return Bluebird.delay(retryDelayMs).then(() =>
              attemptExtract(retriesLeft - 1),
            );
          }

          if (severity === "critical" || isCritical(errorMsg)) {
            return Bluebird.reject(
              new ArchiveBrokenError(path.basename(archivePath), errorMsg),
            );
          }

          return Bluebird.reject(err);
        });
    };

    return attemptExtract(maxRetries);
  }

  /**
   * Check if a file extension is a supported archive type.
   */
  public static isArchiveExtension(ext: string): boolean {
    const normalizedExt = ext.toLowerCase().startsWith(".")
      ? ext.toLowerCase()
      : `.${ext.toLowerCase()}`;
    return ARCHIVE_EXTENSIONS.has(normalizedExt);
  }

  /**
   * Check if extraction should be avoided for this file type.
   */
  public static shouldAvoidExtraction(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return FILETYPES_AVOID.includes(ext);
  }

  /**
   * Get the archive name from a path (without extension).
   */
  public static getArchiveBaseName(archivePath: string): string {
    return (
      path.basename(archivePath, path.extname(archivePath)).trim() || "mod"
    );
  }
}

// Re-import for static method
import { ARCHIVE_EXTENSIONS } from "./types";

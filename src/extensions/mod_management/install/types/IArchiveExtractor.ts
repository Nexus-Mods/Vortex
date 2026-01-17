/**
 * Type definitions for archive extraction.
 */

/**
 * Result of an extraction operation.
 */
export interface IExtractionResult {
  /** Exit code from 7z (0 = success) */
  code: number;
  /** Any error messages from 7z */
  errors: string[];
  /** Time taken in milliseconds */
  durationMs: number;
}

/**
 * Progress callback for extraction operations.
 * @param files - Files being processed
 * @param percent - Progress percentage (0-100)
 */
export type ExtractionProgressCallback = (
  files: string[],
  percent: number,
) => void;

/**
 * Password query callback for protected archives.
 * Should return a Promise that resolves to the password string,
 * or rejects if the user cancels.
 */
export type PasswordQueryCallback = () => Promise<string>;

/**
 * Options for extraction operations.
 */
export interface IExtractionOptions {
  /** Maximum retry attempts for retryable errors. Default: 3 */
  maxRetries?: number;
  /** Delay between retry attempts in milliseconds. Default: 1000 */
  retryDelayMs?: number;
  /** Progress callback */
  onProgress?: ExtractionProgressCallback;
  /** Password query callback for encrypted archives */
  queryPassword?: PasswordQueryCallback;
}

/**
 * Configuration for the archive extractor.
 */
export interface IArchiveExtractorConfig {
  /** Default maximum retry attempts */
  defaultMaxRetries: number;
  /** Default delay between retries in milliseconds */
  defaultRetryDelayMs: number;
}

/**
 * Default configuration for the archive extractor.
 */
export const DEFAULT_EXTRACTOR_CONFIG: IArchiveExtractorConfig = {
  defaultMaxRetries: 3,
  defaultRetryDelayMs: 1000,
};

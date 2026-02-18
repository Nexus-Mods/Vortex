/**
 * UnixFilesystem - Mock filesystem with Unix behavior
 *
 * Characteristics:
 * - Case-sensitive paths (/vortex !== /Vortex)
 * - Forward slash separators
 * - Root at /
 */

import { MockFilesystem } from './MockFilesystem';

/**
 * Mock filesystem with Unix behavior
 * Used for testing Unix-specific path handling
 */
export class UnixFilesystem extends MockFilesystem {
  constructor() {
    super('linux', true);
  }
}

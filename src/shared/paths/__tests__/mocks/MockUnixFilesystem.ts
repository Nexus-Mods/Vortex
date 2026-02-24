/**
 * MockUnixFilesystem - Mock filesystem with Unix behavior
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
export class MockUnixFilesystem extends MockFilesystem {
  constructor() {
    super('unix', true);
  }
}

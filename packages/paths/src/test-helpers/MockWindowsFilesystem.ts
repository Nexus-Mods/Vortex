/**
 * MockWindowsFilesystem - Mock filesystem with Windows behavior
 *
 * Characteristics:
 * - Case-insensitive paths (C:\Vortex === C:\vortex)
 * - Backslash separators
 * - Drive letters (C:\, D:\)
 */

import { MockFilesystem } from "./MockFilesystem";

/**
 * Mock filesystem with Windows behavior
 * Used for testing Windows-specific path handling
 */
export class MockWindowsFilesystem extends MockFilesystem {
  constructor() {
    super("windows", false);
  }
}

import type { FileSystem } from "@vortex/shared/filesystem";

let instance: FileSystem | undefined;

/**
 * Stores the process-wide filesystem singleton. Call once during startup;
 * re-initialization is an error, use {@link setFileSystem} to swap the
 * instance instead.
 */
export function initFileSystem(fs: FileSystem): void {
  if (instance !== undefined) {
    throw new Error("Filesystem is already initialized");
  }
  instance = fs;
}

/**
 * Returns the filesystem initialized by {@link initFileSystem}. Every
 * main-process consumer that cannot take the filesystem as a parameter
 * reads it through here.
 */
export function getFileSystem(): FileSystem {
  if (instance === undefined) {
    throw new Error("Filesystem is not initialized");
  }
  return instance;
}

/**
 * Replaces the singleton without the initialized guard. Tests use this to
 * swap in an InMemoryFS or a ChaosFS wrapper.
 */
export function setFileSystem(fs: FileSystem): void {
  instance = fs;
}

/** Clears the singleton. Test isolation helper. */
export function resetFileSystem(): void {
  instance = undefined;
}

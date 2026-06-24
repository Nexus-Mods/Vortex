/**
 * Renderer-side bsdiff client. The BSDIFF40 work runs on a main-process
 * worker_thread (see src/main/src/bsdiff); these helpers forward file paths to
 * it over IPC. Kept as diffFiles/patchFiles so binaryPatching and other callers
 * stay unchanged.
 */

/** Create a BSDIFF40 patch file from two files. */
export function diffFiles(oldPath: string, newPath: string, patchPath: string): Promise<void> {
  return window.api.bsdiff.diff(oldPath, newPath, patchPath);
}

/** Apply a BSDIFF40 patch file, writing the result to outputPath. */
export function patchFiles(oldPath: string, outputPath: string, patchPath: string): Promise<void> {
  return window.api.bsdiff.patch(oldPath, outputPath, patchPath);
}

import { createHash } from "crypto";

export function checksum(input: Buffer): string {
  return createHash("md5").update(input).digest("hex");
}

export async function fileMD5(
  input: string | Buffer,
  progress?: (bytesProcessed: number, totalBytes: number) => void,
): Promise<string> {
  // A Buffer is already in renderer memory, so hash it here rather than over IPC:
  // the renderer<->main boundary is structured-clone, so offloading would copy the
  // whole buffer across for no gain. Only file paths go to the worker, where the
  // bytes are read worker-side and never cross the boundary.
  if (Buffer.isBuffer(input)) {
    const hex = createHash("md5").update(input).digest("hex");
    progress?.(input.length, input.length);
    return hex;
  }

  // Hash the file on a main-process worker_thread so a large file doesn't block
  // the renderer. Progress is not streamed back over IPC, so report completion
  // once when the digest returns.
  const { hash, numBytes } = await window.api.hash.compute("md5", input);
  progress?.(numBytes, numBytes);
  return hash;
}

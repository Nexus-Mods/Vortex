import * as os from "os";
import * as path from "path";

/**
 * Returns the platform-correct IPC path for the given identifier.
 * - Windows: \\?\pipe\{id}  (UNC named pipe)
 * - Linux:   /tmp/vortex-{id}.sock  (Unix domain socket)
 */
export function getIPCPath(id: string): string {
  if (process.platform === "linux") {
    return path.join(os.tmpdir(), `vortex-${id}.sock`);
  }
  return path.join("\\\\?\\pipe", id);
}

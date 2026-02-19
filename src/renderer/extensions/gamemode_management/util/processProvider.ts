import psList from "ps-list";

/**
 * A single process snapshot from the provider.
 * - `pid`/`ppid` are OS process IDs (numeric identifiers only; not time/memory units).
 * - `name` is the executable basename used to build exe IDs.
 * - `cmd` is the raw command line when available.
 * - `path` is the absolute executable path when available (may be derived from cmd).
 */
export interface IProcessInfo {
  /** OS process id (numeric identifier only; no time/memory units). */
  pid: number;
  /** Parent process id (numeric identifier only); 0 for root/system processes. */
  ppid: number;
  /** Executable basename used to normalize exe IDs. */
  name: string;
  /** Raw command line, if provided by the OS/provider. */
  cmd?: string;
  /** Absolute executable path when available; may be derived from cmd. */
  path?: string;
}

/**
 * Supplies a full process list snapshot used for matching running tools.
 * Numeric fields in the contract are OS process IDs only.
 */
export interface IProcessProvider {
  /**
   * Returns all visible processes. Optional fields may be unavailable on some OSes.
   */
  list(): Promise<IProcessInfo[]>;
}

/** Default provider backed by ps-list; cmd/path availability varies by platform. */
export class PsListProcessProvider implements IProcessProvider {
  /**
   * ps-list does not expose a dedicated path field; callers may parse cmd.
   */
  public async list(): Promise<IProcessInfo[]> {
    const processes = await psList({ all: true });
    return processes.map((proc) => ({
      pid: proc.pid,
      ppid: proc.ppid,
      name: proc.name,
      cmd: proc.cmd,
      // ps-list doesn't provide a 'path' property; it must be derived from 'cmd'
    }));
  }
}

export const defaultProcessProvider = new PsListProcessProvider();

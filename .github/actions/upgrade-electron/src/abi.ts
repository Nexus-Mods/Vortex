import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CHECK_SCRIPT =
  "import { getAbi } from 'node-abi'; getAbi(process.env.ELECTRON_VERSION, 'electron');";

/** The message node-abi throws for a version missing from its registry. */
const UNKNOWN_VERSION = "Could not detect abi";

/**
 * Whether the node-abi installed in `cwd` can resolve the ABI of this Electron
 * version. Runs in a fresh process so a node-abi installed mid-run is seen
 * (module caches would hide it). Any failure other than node-abi not knowing
 * the version is rethrown.
 */
export const abiKnown = async (electronVersion: string, cwd: string): Promise<boolean> => {
  try {
    await execFileAsync(process.execPath, ["--input-type=module", "-e", CHECK_SCRIPT], {
      cwd,
      env: { ...process.env, ELECTRON_VERSION: electronVersion },
    });
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && "stderr" in err && String(err.stderr).includes(UNKNOWN_VERSION)) {
      return false;
    }
    throw err;
  }
};

import * as path from "path";

import type * as Redux from "redux";

import { BACKUP_HIVES, serializeState } from "../../../store/store";
import type { IState } from "../../../types/IState";
import { getApplication } from "../../../util/application";
import { UserCanceled } from "../../../util/CustomErrors";
import * as fs from "../../../util/fs";
import getVortexPath from "../../../util/getVortexPath";
import { log } from "../../../util/log";
import { userInfo } from "../../../util/selectors";
import { sanitizeFilename } from "../../../util/util";
import { hasNonAscii, redactSensitiveText } from "./redact";

export interface IPrepareSupportBundleOptions {
  /** 7-Zip progress, 0 to 100. */
  onProgress?: (percent: number) => void;
  /** Aborting kills the archiver and removes everything the bundle wrote so far. */
  signal?: AbortSignal;
}

export interface ISupportBundle {
  archivePath: string;
  /** Deletes the archive. The staging folder is already gone by the time the bundle resolves. */
  cleanup: () => Promise<void>;
}

export interface ISupportBundleManifest {
  schemaVersion: number;
  createdAt: string;
  vortexVersion: string;
  nexusUsername: string | undefined;
  nexusUserId: number | undefined;
  platform: string;
  platformVersion: string;
  arch: string;
  /**
   * Usernames are redacted from every file, so this carries the one fact about the profile
   * path that still matters for diagnosis.
   */
  userPathHasNonAscii: boolean;
  /** Paths relative to the archive root, e.g. "logs/vortex.log". */
  files: string[];
}

export interface IBuildManifestParams {
  createdAt: Date;
  vortexVersion: string;
  nexusUsername: string | undefined;
  nexusUserId: number | undefined;
  userPathHasNonAscii: boolean;
  files: string[];
}

/**
 * Drops what the state export must not carry once it leaves the machine: the in-flight OAuth
 * state under `session.nexus`, and the account email under `persistent.nexus.userInfo`, since a
 * bundle may well end up attached to a public forum post. Shallow copies only: the state can
 * run to tens of MB and is about to be stringified anyway.
 */
function scrubState(state: IState): IState {
  let scrubbed = state;

  const sessionNexus = (state.session as { nexus?: Record<string, unknown> }).nexus;
  if (sessionNexus !== undefined) {
    const { oauthPending: _oauthPending, loginId: _loginId, ...rest } = sessionNexus;
    scrubbed = { ...scrubbed, session: { ...state.session, nexus: rest } as IState["session"] };
  }

  const persistentNexus = (state.persistent as { nexus?: { userInfo?: Record<string, unknown> } })
    .nexus;
  if (persistentNexus?.userInfo !== undefined) {
    const { email: _email, ...userInfo } = persistentNexus.userInfo;
    scrubbed = {
      ...scrubbed,
      persistent: {
        ...scrubbed.persistent,
        nexus: { ...persistentNexus, userInfo },
      } as IState["persistent"],
    };
  }

  return scrubbed;
}

const LOG_FILE_RE = /^vortex\d?\.log$/;

function pad(value: number, width: number = 2): string {
  return value.toString().padStart(width, "0");
}

/** `YYYYMMDD-HHmmss` in local time, so the name lines up with what the user saw on the clock. */
export function formatBundleTimestamp(date: Date): string {
  return (
    `${pad(date.getFullYear(), 4)}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/**
 * Spaces go too: the filename gets pasted into chat and ticket systems that break an
 * unquoted path at the first space.
 */
function filenamePart(input: string): string {
  return sanitizeFilename(input).replace(/\s+/g, "-");
}

export function buildBundleFilename(
  version: string,
  username: string | undefined,
  date: Date,
): string {
  const who = username !== undefined && username !== "" ? username : "anonymous";
  return (
    `vortex-support-bundle_${filenamePart(version)}_${filenamePart(who)}` +
    `_${formatBundleTimestamp(date)}.7z`
  );
}

/**
 * The files winston writes next to the state. `startup.log` is deliberately out: it's written
 * by the main process before logging is configured and holds nothing we can't get elsewhere.
 */
export function isBundledLogFile(name: string): boolean {
  return LOG_FILE_RE.test(name) || name === "network.log";
}

/**
 * The newest dumps are the crash the user is writing in about. Anything older is backlog the
 * startup sweep in the main process will bin anyway, and each dump can run to several MB.
 */
export const MAX_CRASH_DUMPS = 3;

export interface ICrashDumpFile {
  path: string;
  mtimeMs: number;
}

/** Newest first, capped at `limit`. */
export function pickLatestCrashDumps(
  dumps: ICrashDumpFile[],
  limit: number = MAX_CRASH_DUMPS,
): ICrashDumpFile[] {
  return [...dumps].sort((lhs, rhs) => rhs.mtimeMs - lhs.mtimeMs).slice(0, limit);
}

const CRASH_DUMP_WALK_DEPTH = 3;

/**
 * Crashpad nests dumps in `reports/` and `pending/`, so walk shallowly. Same shape as the
 * sweep in `src/main/src/errorReporting.ts`. A `.dmp.claimed` file is one that sweep is
 * processing right now, so the plain `.dmp` check leaves it alone.
 */
async function collectCrashDumps(dir: string, depth: number = 0): Promise<ICrashDumpFile[]> {
  let names: string[];
  try {
    names = await fs.readdirAsync(dir);
  } catch {
    return [];
  }

  const found: ICrashDumpFile[] = [];
  for (const name of names) {
    const fullPath = path.join(dir, name);
    try {
      const stats = await fs.statAsync(fullPath);
      if (stats.isDirectory()) {
        if (depth < CRASH_DUMP_WALK_DEPTH) {
          found.push(...(await collectCrashDumps(fullPath, depth + 1)));
        }
      } else if (name.toLowerCase().endsWith(".dmp")) {
        found.push({ path: fullPath, mtimeMs: stats.mtimeMs });
      }
    } catch {
      // the sweep may be renaming or deleting it under us; it is not ours to fight over
    }
  }

  return found;
}

export function buildManifest(params: IBuildManifestParams): ISupportBundleManifest {
  const app = getApplication();
  return {
    schemaVersion: 1,
    createdAt: params.createdAt.toISOString(),
    vortexVersion: params.vortexVersion,
    nexusUsername: params.nexusUsername,
    nexusUserId: params.nexusUserId,
    platform: process.platform,
    platformVersion: app.platformVersion,
    arch: process.arch,
    userPathHasNonAscii: params.userPathHasNonAscii,
    files: params.files,
  };
}

/** The 4-arg shape node-7z actually calls the progress callback with. */
type SevenZipProgressCB = (
  entries: string[],
  percent: number | undefined,
  stdin: unknown,
  cancel: () => void,
) => void;

async function removeQuietly(target: string): Promise<void> {
  try {
    await fs.removeAsync(target);
  } catch {
    // best effort, the caller is already on its way out with a more interesting error
  }
}

async function copyLogs(
  userData: string,
  logsDir: string,
  signal: AbortSignal | undefined,
): Promise<string[]> {
  const names = (await fs.readdirAsync(userData)).filter(isBundledLogFile).sort();

  const copied: string[] = [];
  for (const name of names) {
    if (signal?.aborted === true) {
      throw new UserCanceled();
    }
    try {
      // Read, redact and write rather than copy: the logs are where usernames and signed
      // download links show up most. Ten MB of text per file is fine to hold in memory.
      const text: string = await fs.readFileAsync(path.join(userData, name), "utf8");
      await fs.writeFileAsync(path.join(logsDir, name), redactSensitiveText(text));
      copied.push(name);
    } catch (err) {
      // ENOENT means winston rotated the file out from under us between readdir and copy.
      // Anything else (a lock, an AV grab) costs us one log file, not the whole bundle.
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        log("warn", "failed to add log file to support bundle", { name, error: err });
      }
    }
  }

  return copied;
}

async function copyCrashDumps(
  userData: string,
  dumpsDir: string,
  signal: AbortSignal | undefined,
): Promise<string[]> {
  const latest = pickLatestCrashDumps(
    await collectCrashDumps(path.join(userData, "temp", "dumps")),
  );

  const copied: string[] = [];
  for (const dump of latest) {
    if (signal?.aborted === true) {
      throw new UserCanceled();
    }
    // Crashpad names dumps by a unique id, but the same id can sit in two folders while it is
    // being moved between them, so fall back to naming by folder rather than overwrite.
    let name = path.basename(dump.path);
    if (copied.includes(name)) {
      name = `${path.basename(path.dirname(dump.path))}-${name}`;
    }
    try {
      await fs.copyAsync(dump.path, path.join(dumpsDir, name));
      copied.push(name);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        log("warn", "failed to add crash dump to support bundle", { name, error: err });
      }
    }
  }

  return copied;
}

async function runArchiver(
  archivePath: string,
  entries: string[],
  options: IPrepareSupportBundleOptions,
): Promise<void> {
  const { onProgress, signal } = options;

  // Loaded here rather than at module scope so the 7-Zip binding only gets pulled in when a
  // user actually asks for a bundle.
  const { default: Zip } = await import("node-7z");
  const task = new Zip();

  // node-7z hands us the kill function through the progress callback, so it isn't available
  // until the child has said something. Registering the listener first means an abort that
  // lands in that window still kills the process, via the check inside the callback.
  let cancel: (() => void) | undefined;
  const onAbort = (): void => cancel?.();
  signal?.addEventListener("abort", onAbort);

  const progress: SevenZipProgressCB = (_entries, percent, _stdin, cancelCB) => {
    cancel = cancelCB;
    if (signal?.aborted === true) {
      cancelCB();
      return;
    }
    if (percent !== undefined) {
      onProgress?.(percent);
    }
  };

  try {
    // mx has to be a string: node-7z calls indexOf on every non-boolean switch value.
    //
    // -md caps the LZMA2 dictionary at 16MB. Left to itself -mx9 picks 64MB, and since 7-Zip
    // needs roughly ten times the dictionary to compress, that costs far more memory than the
    // input is worth. Measured on 42MB of real logs: 453MB peak against 199MB, same 4.6s, and
    // the archive grows by 30KB. Someone building a support bundle is often already short of
    // memory, so the 30KB is a good trade.
    const result = await task.add(
      archivePath,
      entries,
      { mx: "9", ssw: true, raw: ["-m0=LZMA2", "-md=16m"] },
      progress as unknown as (entries: string[], percent: number) => void,
    );

    // A killed child and a genuine 7-Zip failure both come back as a resolved promise with a
    // non-zero code, so the signal is what tells the two apart.
    if (signal?.aborted === true) {
      throw new UserCanceled();
    }

    const code = result?.code ?? 0;
    const errors = result?.errors ?? [];
    if (code !== 0 || errors.length > 0) {
      const detail = errors.length > 0 ? errors.join("; ") : `exit code ${code}`;
      throw new Error(`Failed to create support bundle archive: ${detail}`);
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Builds a `.7z` support bundle holding every Vortex log file, a state export (the backup hives
 * plus `session`) and a small manifest, under `<userData>/temp/support_bundles`.
 *
 * Rejects with `UserCanceled` when `options.signal` is aborted.
 */
export async function prepareSupportBundle(
  store: Redux.Store<IState>,
  options: IPrepareSupportBundleOptions = {},
): Promise<ISupportBundle> {
  const { signal } = options;
  const startedAt = Date.now();

  const checkAborted = (): void => {
    if (signal?.aborted === true) {
      throw new UserCanceled();
    }
  };

  checkAborted();

  const userData = getVortexPath("userData");
  const outDir = path.join(userData, "temp", "support_bundles");
  await fs.ensureDirWritableAsync(outDir, () => Promise.resolve());

  const state = store.getState();
  const info = userInfo(state);
  const vortexVersion = getApplication().version;

  const now = new Date();
  const stamp = formatBundleTimestamp(now);
  const archivePath = path.join(outDir, buildBundleFilename(vortexVersion, info?.name, now));
  const staging = path.join(outDir, `staging-${stamp}`);
  const logsDir = path.join(staging, "logs");
  const dumpsDir = path.join(staging, "dumps");
  const stateDir = path.join(staging, "state");

  try {
    checkAborted();
    await fs.ensureDirAsync(logsDir);
    await fs.ensureDirAsync(dumpsDir);
    await fs.ensureDirAsync(stateDir);

    checkAborted();
    const logNames = await copyLogs(userData, logsDir, signal);

    checkAborted();
    const dumpNames = await copyCrashDumps(userData, dumpsDir, signal);

    checkAborted();
    // Yield once so the modal's spinner gets a frame before the stringify blocks the renderer.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const scrubbed = scrubState(state);
    const serialized = redactSensitiveText(
      serializeState({ getState: () => scrubbed } as unknown as Redux.Store<IState>, [
        ...BACKUP_HIVES,
        "session",
      ]),
    );
    await fs.writeFileAsync(path.join(stateDir, "state.json"), serialized);

    checkAborted();
    const manifest = buildManifest({
      createdAt: now,
      vortexVersion,
      nexusUsername: info?.name,
      nexusUserId: info?.userId,
      userPathHasNonAscii: hasNonAscii(userData),
      files: [
        ...logNames.map((name) => `logs/${name}`),
        ...dumpNames.map((name) => `dumps/${name}`),
        "state/state.json",
      ],
    });
    await fs.writeFileAsync(
      path.join(staging, "bundle.json"),
      JSON.stringify(manifest, undefined, 2),
    );

    checkAborted();
    // The entries go in individually so they land at the archive root; handing 7-Zip the
    // staging folder would nest everything under "staging-<stamp>/". An empty dumps folder
    // is left out rather than shipped as a bare directory entry.
    await runArchiver(
      archivePath,
      [
        logsDir,
        ...(dumpNames.length > 0 ? [dumpsDir] : []),
        stateDir,
        path.join(staging, "bundle.json"),
      ],
      options,
    );

    await fs.removeAsync(staging);

    log("info", "support bundle created", { ms: Date.now() - startedAt, archivePath });

    return {
      archivePath,
      cleanup: async () => {
        await fs.removeAsync(archivePath);
      },
    };
  } catch (err) {
    await removeQuietly(staging);
    await removeQuietly(archivePath);
    // 7-Zip writes to "<archive>.tmp" and renames on success, so a killed run leaves that behind.
    await removeQuietly(`${archivePath}.tmp`);
    throw err;
  }
}

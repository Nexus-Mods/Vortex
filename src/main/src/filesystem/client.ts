import type {
  FileSystemErrorCode,
  IFileSystem,
  StatResult,
  Status,
} from "@vortex/fs";
import type { Pattern } from "@vortex/fs";

import { FileSystemError, QualifiedPath } from "@vortex/fs";

/**
 * Send function shape used by the client polyfill. The caller provides a
 * function that dispatches `(method, args)` to the host-side filesystem
 * service, awaits the structured-cloned result, and rethrows any error.
 *
 * An error whose `name === "FileSystemError"` is rehydrated into a real
 * {@link FileSystemError} with its `code` / `isTransient` intact.
 *
 * @public
 */
export type FileSystemSendFn = (
  method: string,
  args: readonly unknown[],
) => Promise<unknown>;

/**
 * Wire-level enumeration options. This is an implementation detail of
 * the RPC layer: the real consumer sees the options type declared on
 * `IFileSystem["enumerateDirectory"]`. Kept internal so callers are not
 * tempted to program against it.
 */
interface EnumerateWireOptions {
  includeStatus?: boolean | "symlink";
  types?: "all" | "files" | "directories";
  recursive?: boolean;
  include?: Pattern;
  exclude?: Pattern;
}

interface EnumerateOpenResult {
  cursorId: string;
  batch: unknown[];
  done: boolean;
}

interface EnumerateNextResult {
  batch: unknown[];
  done: boolean;
}

/**
 * Creates an object that implements {@link IFileSystem} by routing every
 * call through {@link FileSystemSendFn}. Intended for use inside
 * environments (adaptor Workers, renderers) that cannot touch the real
 * fs directly.
 *
 * @public
 */
export function createFileSystemClient(send: FileSystemSendFn): IFileSystem {
  const call = async <T>(
    method: string,
    args: readonly unknown[],
  ): Promise<T> => {
    try {
      return (await send(method, args)) as T;
    } catch (err) {
      throw rehydrateError(err);
    }
  };

  const enumerateDirectory = (
    path: QualifiedPath,
    options?: EnumerateWireOptions,
  ): Promise<AsyncIterator<QualifiedPath | [QualifiedPath, Status]>> =>
    Promise.resolve(createEnumerationIterator(call, path, options));

  return {
    copy: (source, target, options) =>
      call<void>("copy", [source, target, options]),
    move: (source, target, options) =>
      call<void>("move", [source, target, options]),
    readFile: (path) => call<Uint8Array>("readFile", [path]),
    writeFile: (path, contents) => call<void>("writeFile", [path, contents]),
    createDirectory: (path) => call<void>("createDirectory", [path]),
    delete: (path) => call<void>("delete", [path]),
    deleteRecursive: (path) => call<void>("deleteRecursive", [path]),
    stat: (path, options) => call<StatResult>("stat", [path, options]),
    // The three enumerateDirectory overloads on IFileSystem all funnel
    // into the same polyfill; the cast is safe because each call site
    // narrows by `options.includeStatus` which the iterator forwards
    // unchanged to the host.
    enumerateDirectory: enumerateDirectory as IFileSystem["enumerateDirectory"],
  };
}

type CallFn = <T>(method: string, args: readonly unknown[]) => Promise<T>;

function createEnumerationIterator(
  call: CallFn,
  path: QualifiedPath,
  options: EnumerateWireOptions | undefined,
): AsyncIterator<QualifiedPath | [QualifiedPath, Status]> {
  type Entry = QualifiedPath | [QualifiedPath, Status];

  let cursorId: string | undefined;
  let queue: Entry[] = [];
  let done = false;
  let opened = false;

  const pump = async (): Promise<void> => {
    if (done || queue.length > 0) return;

    if (!opened) {
      const res = await call<EnumerateOpenResult>("enumerateOpen", [
        path,
        options,
      ]);
      cursorId = res.cursorId;
      queue = res.batch.map(rehydrateEntry);
      done = res.done;
      opened = true;
      return;
    }

    if (cursorId === undefined) {
      done = true;
      return;
    }

    const res = await call<EnumerateNextResult>("enumerateNext", [cursorId]);
    queue = res.batch.map(rehydrateEntry);
    done = res.done;
  };

  const close = async (): Promise<void> => {
    const id = cursorId;
    cursorId = undefined;
    done = true;
    queue = [];
    if (id !== undefined) {
      // Best-effort: the host is authoritative for cursor lifetime; ignore
      // close-time errors so that early termination never surfaces a new
      // exception on top of whatever caused the consumer to bail.
      await call("enumerateClose", [id]).catch(() => undefined);
    }
  };

  return {
    async next() {
      await pump();
      const next = queue.shift();
      if (next !== undefined) {
        return { done: false, value: next };
      }
      return { done: true, value: undefined as never };
    },
    async return() {
      await close();
      return { done: true, value: undefined as never };
    },
    async throw(err) {
      await close();
      throw err;
    },
  };
}

function rehydrateEntry(raw: unknown): QualifiedPath | [QualifiedPath, Status] {
  if (Array.isArray(raw)) {
    const [qp, status] = raw as [unknown, Status];
    return [rehydrateQualifiedPath(qp), status];
  }
  return rehydrateQualifiedPath(raw);
}

function rehydrateQualifiedPath(raw: unknown): QualifiedPath {
  if (raw instanceof QualifiedPath) return raw;
  if (
    raw !== null &&
    typeof raw === "object" &&
    "value" in raw &&
    typeof (raw as { value: unknown }).value === "string"
  ) {
    return QualifiedPath.parse((raw as { value: string }).value);
  }
  throw new Error("Cannot rehydrate QualifiedPath: missing `value`");
}

function rehydrateError(err: unknown): unknown {
  if (!(err instanceof Error) || err.name !== "FileSystemError") return err;

  const e = err as Error & {
    code?: unknown;
    isTransient?: unknown;
    cause?: unknown;
  };
  const code: FileSystemErrorCode =
    typeof e.code === "string" ? (e.code as FileSystemErrorCode) : "generic";
  const isTransient = Boolean(e.isTransient);
  // If the transport envelope carried a cause, prefer it over wrapping the
  // envelope-rehydrated Error in itself — the cause is the real underlying
  // failure (e.g. a Node ENOENT), while `err` is a wire-side duplicate of
  // the FileSystemError we're about to construct.
  const cause = e.cause !== undefined ? e.cause : err;
  return new FileSystemError(code, err.message, cause, isTransient);
}

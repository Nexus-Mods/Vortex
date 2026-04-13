import type { IMessage, IMessageHandler } from "@vortex/adaptor-api";
import type {
  FileSystemBackend,
  Pattern,
  PathResolver,
  ResolvedPath,
  Status,
} from "@vortex/fs";

import { QualifiedPath } from "@vortex/fs";
import { sep as pathSep } from "node:path";

interface EnumerateOptions {
  includeStatus?: boolean | "symlink";
  types?: "all" | "files" | "directories";
  recursive?: boolean;
  include?: Pattern;
  exclude?: Pattern;
}

interface FsPayload {
  method: string;
  args: unknown[];
}

interface CursorEntry {
  iterator: AsyncIterator<ResolvedPath | readonly [ResolvedPath, Status]>;
  rootQP: QualifiedPath;
  rootResolved: ResolvedPath;
  includeStatus: boolean;
}

/** Maximum entries pulled from a backend iterator per RPC call. */
const DEFAULT_BATCH_SIZE = 128;

/**
 * Handler for the `vortex:host/filesystem` URI. Rehydrates `QualifiedPath`
 * arguments (structured-cloned across the worker boundary), resolves them
 * to native paths via the supplied {@link PathResolver}, and delegates to
 * the supplied {@link FileSystemBackend}.
 *
 * Enumeration is exposed as three cursor methods — `enumerateOpen`,
 * `enumerateNext`, `enumerateClose` — because `AsyncIterator` is not
 * serialisable. Open cursors can be released in bulk via the returned
 * `closeAll` helper (wire this to worker shutdown).
 */
export interface FileSystemServiceHandler {
  handler: IMessageHandler;
  /** Close and forget every open cursor. Safe to call multiple times. */
  closeAll(): Promise<void>;
}

export function createFileSystemServiceHandler(
  backend: FileSystemBackend,
  resolver: PathResolver,
  options?: { batchSize?: number },
): FileSystemServiceHandler {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const cursors = new Map<string, CursorEntry>();
  let cursorCounter = 0;

  const toQP = (value: unknown): QualifiedPath => {
    if (value instanceof QualifiedPath) return value;
    if (
      value !== null &&
      typeof value === "object" &&
      "value" in value &&
      typeof (value as { value: unknown }).value === "string"
    ) {
      return QualifiedPath.parse((value as { value: string }).value);
    }
    throw new TypeError("Expected QualifiedPath");
  };

  const resolve = (value: unknown) => resolver.resolve(toQP(value));

  const dispatch = async (payload: FsPayload): Promise<unknown> => {
    const { method, args } = payload;
    switch (method) {
      case "copy": {
        const [src, dst, opts] = args as [
          unknown,
          unknown,
          { overwrite: boolean } | undefined,
        ];
        await backend.copy(await resolve(src), await resolve(dst), opts);
        return undefined;
      }
      case "move": {
        const [src, dst, opts] = args as [
          unknown,
          unknown,
          { overwrite: boolean } | undefined,
        ];
        await backend.move(await resolve(src), await resolve(dst), opts);
        return undefined;
      }
      case "readFile": {
        const [p] = args;
        return backend.readFile(await resolve(p));
      }
      case "writeFile": {
        const [p, contents] = args as [unknown, Uint8Array];
        await backend.writeFile(await resolve(p), contents);
        return undefined;
      }
      case "createDirectory": {
        const [p] = args;
        await backend.createDirectory(await resolve(p));
        return undefined;
      }
      case "delete": {
        const [p] = args;
        await backend.delete(await resolve(p));
        return undefined;
      }
      case "deleteRecursive": {
        const [p] = args;
        await backend.deleteRecursive(await resolve(p));
        return undefined;
      }
      case "stat": {
        const [p, opts] = args as [
          unknown,
          { parseSymLink: boolean } | undefined,
        ];
        return backend.stat(await resolve(p), opts);
      }
      case "enumerateOpen": {
        const [pathArg, opts] = args as [unknown, EnumerateOptions | undefined];
        const rootQP = toQP(pathArg);
        const rootResolved = await resolver.resolve(rootQP);
        const iterator = await backend.enumerateDirectory(
          rootResolved,
          (opts ?? {}) as Parameters<
            FileSystemBackend["enumerateDirectory"]
          >[1],
        );
        const includeStatus = Boolean(opts?.includeStatus);
        const cursorId = `fs-cur:${++cursorCounter}`;
        const entry: CursorEntry = {
          iterator,
          rootQP,
          rootResolved,
          includeStatus,
        };
        cursors.set(cursorId, entry);

        const { batch, done } = await pullBatch(entry, batchSize);
        if (done) cursors.delete(cursorId);
        return { cursorId, batch, done };
      }
      case "enumerateNext": {
        const [cursorId] = args as [string];
        const entry = cursors.get(cursorId);
        if (entry === undefined) return { batch: [], done: true };
        const { batch, done } = await pullBatch(entry, batchSize);
        if (done) cursors.delete(cursorId);
        return { batch, done };
      }
      case "enumerateClose": {
        const [cursorId] = args as [string];
        const entry = cursors.get(cursorId);
        if (entry !== undefined) {
          cursors.delete(cursorId);
          await entry.iterator.return?.(undefined).catch(() => undefined);
        }
        return undefined;
      }
      default:
        throw new Error(`Unknown filesystem method: ${method}`);
    }
  };

  const handler: IMessageHandler = (msg: IMessage<unknown>) =>
    dispatch(msg.payload as FsPayload);

  const closeAll = async (): Promise<void> => {
    const entries = [...cursors.values()];
    cursors.clear();
    await Promise.all(
      entries.map((e) =>
        Promise.resolve(e.iterator.return?.(undefined)).catch(() => undefined),
      ),
    );
  };

  return { handler, closeAll };
}

async function pullBatch(
  entry: CursorEntry,
  size: number,
): Promise<{
  batch: Array<QualifiedPath | [QualifiedPath, Status]>;
  done: boolean;
}> {
  const batch: Array<QualifiedPath | [QualifiedPath, Status]> = [];
  for (let i = 0; i < size; i++) {
    const next = await entry.iterator.next();
    if (next.done === true) {
      return { batch, done: true };
    }
    const value: ResolvedPath | readonly [ResolvedPath, Status] = next.value;
    batch.push(toQualifiedEntry(entry, value));
  }
  return { batch, done: false };
}

function toQualifiedEntry(
  entry: CursorEntry,
  raw: ResolvedPath | readonly [ResolvedPath, Status],
): QualifiedPath | [QualifiedPath, Status] {
  if (entry.includeStatus) {
    const [resolvedPath, status] = raw as readonly [ResolvedPath, Status];
    return [assembleQP(entry.rootQP, entry.rootResolved, resolvedPath), status];
  }
  return assembleQP(entry.rootQP, entry.rootResolved, raw as ResolvedPath);
}

function assembleQP(
  root: QualifiedPath,
  rootResolved: ResolvedPath,
  entry: ResolvedPath,
): QualifiedPath {
  let rel = entry;
  if (rel.startsWith(rootResolved)) {
    rel = rel.slice(rootResolved.length);
  }
  // Strip leading separators (either platform, since ResolvedPath is native).
  while (rel.startsWith(pathSep) || rel.startsWith("/")) {
    rel = rel.slice(1);
  }
  if (rel.length === 0) return root;
  const components = rel.split(/[\\/]/).filter((c) => c.length > 0);
  if (components.length === 0) return root;
  return root.join(...components);
}

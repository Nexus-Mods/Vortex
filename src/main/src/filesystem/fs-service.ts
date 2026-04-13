import type { IMessage, IMessageHandler } from "@vortex/adaptor-api";
import type { IFileSystem, Pattern, Status } from "@vortex/fs";

import { QualifiedPath } from "@vortex/fs";

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
  iterator: AsyncIterator<QualifiedPath | [QualifiedPath, Status]>;
}

/** Maximum entries pulled from an iterator per RPC call. */
const DEFAULT_BATCH_SIZE = 128;

/**
 * Handler for the `vortex:host/filesystem` URI. Rehydrates
 * {@link QualifiedPath} arguments (structured-cloned across the worker
 * boundary), delegates every operation to the supplied
 * {@link IFileSystem}, and batches directory enumeration through a cursor
 * protocol because `AsyncIterator` is not serialisable.
 *
 * Open cursors can be released in bulk via the returned {@link closeAll}
 * helper (wire this to worker shutdown).
 */
export interface FileSystemServiceHandler {
  handler: IMessageHandler;
  /** Close and forget every open cursor. Safe to call multiple times. */
  closeAll(): Promise<void>;
}

export function createFileSystemServiceHandler(
  fs: IFileSystem,
  options?: { batchSize?: number },
): FileSystemServiceHandler {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const cursors = new Map<string, CursorEntry>();
  let cursorCounter = 0;

  const dispatch = async (payload: FsPayload): Promise<unknown> => {
    const { method, args } = payload;
    switch (method) {
      case "copy": {
        const [src, dst, opts] = args as [
          unknown,
          unknown,
          { overwrite: boolean } | undefined,
        ];
        await fs.copy(toQP(src), toQP(dst), opts);
        return undefined;
      }
      case "move": {
        const [src, dst, opts] = args as [
          unknown,
          unknown,
          { overwrite: boolean } | undefined,
        ];
        await fs.move(toQP(src), toQP(dst), opts);
        return undefined;
      }
      case "readFile": {
        const [p] = args;
        return fs.readFile(toQP(p));
      }
      case "writeFile": {
        const [p, contents] = args as [unknown, Uint8Array];
        await fs.writeFile(toQP(p), contents);
        return undefined;
      }
      case "createDirectory": {
        const [p] = args;
        await fs.createDirectory(toQP(p));
        return undefined;
      }
      case "delete": {
        const [p] = args;
        await fs.delete(toQP(p));
        return undefined;
      }
      case "deleteRecursive": {
        const [p] = args;
        await fs.deleteRecursive(toQP(p));
        return undefined;
      }
      case "stat": {
        const [p, opts] = args as [
          unknown,
          { parseSymLink: boolean } | undefined,
        ];
        return fs.stat(toQP(p), opts);
      }
      case "enumerateOpen": {
        const [pathArg, opts] = args as [unknown, EnumerateOptions | undefined];
        const iterator = await fs.enumerateDirectory(
          toQP(pathArg),
          (opts ?? {}) as Parameters<IFileSystem["enumerateDirectory"]>[1],
        );
        const cursorId = `fs-cur:${++cursorCounter}`;
        const entry: CursorEntry = { iterator };
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

function toQP(value: unknown): QualifiedPath {
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
    if (next.done === true) return { batch, done: true };
    batch.push(next.value);
  }
  return { batch, done: false };
}

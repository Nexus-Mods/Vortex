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
 * Restores a {@link QualifiedPath} from a structured-cloned value that
 * crossed the worker RPC boundary. Accepts an existing instance (returned
 * as-is) or a plain object with a string `value` field (re-parsed).
 */
function rehydrate(value: unknown): QualifiedPath {
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

  async function dispatchFlat(
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    switch (method) {
      case "copy": {
        const [s, d, o] = args as [unknown, unknown, { overwrite: boolean }?];
        await fs.copy(rehydrate(s), rehydrate(d), o);
        return;
      }
      case "move": {
        const [s, d, o] = args as [unknown, unknown, { overwrite: boolean }?];
        await fs.move(rehydrate(s), rehydrate(d), o);
        return;
      }
      case "readFile":
        return fs.readFile(rehydrate(args[0]));
      case "writeFile":
        await fs.writeFile(rehydrate(args[0]), args[1] as Uint8Array);
        return;
      case "createDirectory":
        await fs.createDirectory(rehydrate(args[0]));
        return;
      case "delete":
        await fs.delete(rehydrate(args[0]));
        return;
      case "deleteRecursive":
        await fs.deleteRecursive(rehydrate(args[0]));
        return;
      case "stat":
        return fs.stat(
          rehydrate(args[0]),
          args[1] as { parseSymLink: boolean } | undefined,
        );
      default:
        throw new Error(`Unknown filesystem method: ${method}`);
    }
  }

  async function dispatchCursor(
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    if (method === "enumerateOpen") {
      const [pathArg, opts] = args as [unknown, EnumerateOptions?];
      const iterator = await fs.enumerateDirectory(
        rehydrate(pathArg),
        (opts ?? {}) as Parameters<IFileSystem["enumerateDirectory"]>[1],
      );
      const cursorId = `fs-cur:${++cursorCounter}`;
      cursors.set(cursorId, { iterator });
      const { batch, done } = await pullBatch({ iterator }, batchSize);
      if (done) cursors.delete(cursorId);
      return { cursorId, batch, done };
    }
    if (method === "enumerateNext") {
      const [cursorId] = args as [string];
      const entry = cursors.get(cursorId);
      if (entry === undefined) return { batch: [], done: true };
      const { batch, done } = await pullBatch(entry, batchSize);
      if (done) cursors.delete(cursorId);
      return { batch, done };
    }
    if (method === "enumerateClose") {
      const [cursorId] = args as [string];
      const entry = cursors.get(cursorId);
      if (entry !== undefined) {
        cursors.delete(cursorId);
        await entry.iterator.return?.(undefined).catch(() => undefined);
      }
      return;
    }
    throw new Error(`Unknown filesystem method: ${method}`);
  }

  const dispatch = async (payload: FsPayload): Promise<unknown> => {
    const { method, args } = payload;
    if (method.startsWith("enumerate")) return dispatchCursor(method, args);
    return dispatchFlat(method, args);
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
    if (next.done === true) return { batch, done: true };
    batch.push(next.value);
  }
  return { batch, done: false };
}

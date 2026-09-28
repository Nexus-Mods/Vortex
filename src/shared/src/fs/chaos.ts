import type { VortexErrorData, VortexErrorKind } from "../errors/base";
import { VortexError } from "../errors/base";
import type { FileSystem, StatResult, Status } from "./filesystem";
import type { Pattern } from "./matcher";
import type { QualifiedPath } from "./paths";

/**
 * Kinds a chaos rule can inject: every mechanical `fs:*` kind in the
 * {@link VortexErrorKindMap} catalog (derived, so new ones join
 * automatically) plus `os:generic`. Their payloads ChaosFS assembles itself:
 * `path` comes from the matched call, `originalCode` from the rule. Kinds
 * with payloads ChaosFS cannot synthesize (domain kinds like
 * `user-canceled`) are not injectable.
 */
export type ChaosFaultKind = Extract<VortexErrorKind, `fs:${string}`> | "os:generic";

export type ChaosRule = {
  fault: {
    kind: ChaosFaultKind;
    /** Raw OS code carried on `os:generic` faults (EBUSY, EMFILE, EIO, ...). */
    originalCode?: string;
    /** Display message; a default describing the injection is used otherwise. */
    message?: string;
    /** Marks the root cause transient, like the real EBUSY/EMFILE would be. */
    transient?: boolean;
  };
  /** Filesystem method the rule applies to. Default: all methods. */
  op?: keyof FileSystem;
  /** Stream mode the rule applies to (`createStream` only). Default: any. */
  mode?: string;
  /** Path filter; a rule applies when any path argument of the call matches. */
  path?: (path: QualifiedPath) => boolean;
  /** How many matching calls fail. Default: 1. `Infinity` for persistent faults. */
  times?: number;
  /**
   * Chunked operations pass through `failAfter` units before failing: bytes
   * written for write streams, bytes read for read streams, entries yielded
   * for directory iterators.
   */
  failAfter?: number;
};

export class ChaosFS implements FileSystem {
  readonly #inner: FileSystem;
  readonly #rules: ChaosRule[];
  readonly #fired: Map<ChaosRule, number> = new Map();

  constructor(inner: FileSystem, rules: ChaosRule[]) {
    this.#inner = inner;
    this.#rules = rules;
  }

  async copy(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void> {
    const rule = this.#match("copy", undefined, [source, target]);
    if (rule !== undefined) return throwFault(rule, [source, target]);
    return this.#inner.copy(source, target, options);
  }

  async move(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void> {
    const rule = this.#match("move", undefined, [source, target]);
    if (rule !== undefined) return throwFault(rule, [source, target]);
    return this.#inner.move(source, target, options);
  }

  async readFile(path: QualifiedPath): Promise<Uint8Array> {
    const rule = this.#match("readFile", undefined, [path]);
    if (rule !== undefined) return throwFault(rule, [path]);
    return this.#inner.readFile(path);
  }

  async writeFile(path: QualifiedPath, contents: Uint8Array): Promise<void> {
    const rule = this.#match("writeFile", undefined, [path]);
    if (rule !== undefined) return throwFault(rule, [path]);
    return this.#inner.writeFile(path, contents);
  }

  async createDirectory(path: QualifiedPath): Promise<void> {
    const rule = this.#match("createDirectory", undefined, [path]);
    if (rule !== undefined) return throwFault(rule, [path]);
    return this.#inner.createDirectory(path);
  }

  async delete(path: QualifiedPath): Promise<void> {
    const rule = this.#match("delete", undefined, [path]);
    if (rule !== undefined) return throwFault(rule, [path]);
    return this.#inner.delete(path);
  }

  async deleteRecursive(path: QualifiedPath): Promise<void> {
    const rule = this.#match("deleteRecursive", undefined, [path]);
    if (rule !== undefined) return throwFault(rule, [path]);
    return this.#inner.deleteRecursive(path);
  }

  async stat(path: QualifiedPath, options?: { parseSymLink: boolean }): Promise<StatResult> {
    const rule = this.#match("stat", undefined, [path]);
    if (rule !== undefined) return throwFault(rule, [path]);
    return this.#inner.stat(path, options);
  }

  enumerateDirectory(
    path: QualifiedPath,
    options?: {
      includeStatus?: false;
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<QualifiedPath, undefined>>;
  enumerateDirectory(
    path: QualifiedPath,
    options: {
      includeStatus: true | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<[QualifiedPath, Status], undefined>>;
  enumerateDirectory(
    path: QualifiedPath,
    options?: {
      includeStatus?: boolean | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<QualifiedPath | [QualifiedPath, Status], undefined>>;
  async enumerateDirectory(
    path: QualifiedPath,
    options?: {
      includeStatus?: boolean | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<QualifiedPath | [QualifiedPath, Status], undefined>> {
    const rule = this.#match("enumerateDirectory", undefined, [path]);
    if (rule === undefined) return this.#inner.enumerateDirectory(path, options);
    if (rule.failAfter === undefined) return throwFault(rule, [path]);

    const inner = await this.#inner.enumerateDirectory(path, options);
    return failAfterEntries(inner, rule.failAfter, () => faultError(rule, [path]));
  }

  createStream(
    path: QualifiedPath,
    mode: "r",
    options?: { start?: number; end?: number },
  ): Promise<ReadableStream>;
  createStream(
    path: QualifiedPath,
    mode: "w",
    options?: { start?: number },
  ): Promise<WritableStream>;
  createStream(
    path: QualifiedPath,
    mode: string,
    options?: { start?: number; end?: number },
  ): Promise<ReadableStream | WritableStream>;
  async createStream(
    path: QualifiedPath,
    mode: string,
    options?: { start?: number; end?: number },
  ): Promise<ReadableStream | WritableStream> {
    const rule = this.#match("createStream", mode, [path]);
    if (rule === undefined) return this.#inner.createStream(path, mode, options);
    if (rule.failAfter === undefined) return throwFault(rule, [path]);

    const stream = await this.#inner.createStream(path, mode, options);
    return failAfterStream(stream, rule.failAfter, () => faultError(rule, [path]));
  }

  async createLink(
    from: QualifiedPath,
    to: QualifiedPath,
    type: "hardlink" | "symlink",
  ): Promise<void> {
    const rule = this.#match("createLink", undefined, [from, to]);
    if (rule !== undefined) return throwFault(rule, [from, to]);
    return this.#inner.createLink(from, to, type);
  }

  #match(
    op: keyof FileSystem,
    mode: string | undefined,
    paths: QualifiedPath[],
  ): ChaosRule | undefined {
    for (const rule of this.#rules) {
      const fired = this.#fired.get(rule) ?? 0;
      if (fired >= (rule.times ?? 1)) continue;
      if (rule.op !== undefined && rule.op !== op) continue;
      if (rule.mode !== undefined && rule.mode !== mode) continue;
      if (rule.path !== undefined && !paths.some(rule.path)) continue;
      this.#fired.set(rule, fired + 1);
      return rule;
    }
    return undefined;
  }
}

function faultError(rule: ChaosRule, paths: QualifiedPath[]): VortexError {
  const fault = rule.fault;
  const message = fault.message ?? `Injected fault '${fault.kind}'`;
  const matched = paths.find((path) => rule.path?.(path) ?? true);

  const data =
    fault.kind === "os:generic"
      ? ({
          kind: "os:generic",
          originalCode: fault.originalCode ?? "EIO",
        } satisfies VortexErrorData)
      : ({ kind: fault.kind, path: matched?.value ?? "" } satisfies VortexErrorData);

  return new VortexError(message, data, {
    isTransient: fault.transient ?? false,
  });
}

function throwFault(rule: ChaosRule, paths: QualifiedPath[]): never {
  throw faultError(rule, paths);
}

async function* failAfterEntries(
  iterator: AsyncIterator<QualifiedPath | [QualifiedPath, Status], undefined>,
  failAfter: number,
  fault: () => VortexError,
): AsyncGenerator<QualifiedPath | [QualifiedPath, Status], undefined, undefined> {
  let yielded = 0;
  for (;;) {
    if (yielded >= failAfter) throw fault();
    const result = await iterator.next();
    if (result.done) return result.value;
    yielded += 1;
    yield result.value;
  }
}

function failAfterStream(
  stream: ReadableStream | WritableStream,
  failAfter: number,
  fault: () => VortexError,
): ReadableStream | WritableStream {
  if ("getWriter" in stream) {
    const writer = stream.getWriter();
    let written = 0;
    return new WritableStream<Uint8Array>({
      async write(chunk) {
        const allowed = failAfter - written;
        if (allowed <= 0) throw fault();
        const slice = chunk.length <= allowed ? chunk : chunk.subarray(0, allowed);
        await writer.write(slice);
        written += slice.length;
        if (slice.length < chunk.length) throw fault();
      },
      async close() {
        await writer.close();
      },
      async abort(reason?: unknown) {
        await writer.abort(reason);
      },
    });
  }

  const reader = stream.getReader();
  let read = 0;
  return new ReadableStream({
    async pull(controller) {
      if (read >= failAfter) {
        controller.error(fault());
        return;
      }

      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      read += value.length;
      controller.enqueue(value);
    },
    async cancel(reason?: unknown) {
      await reader.cancel(reason);
    },
  });
}

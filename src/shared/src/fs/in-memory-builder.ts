import { VortexError } from "../errors/base";
import type { StatusTime } from "./filesystem";
import { InMemoryFS } from "./in-memory";
import type { FileNode, WalkFailure } from "./in-memory-store";
import { DEFAULT_INSTANT, InMemoryStore } from "./in-memory-store";
import type { QualifiedPath } from "./paths";

/** Seed contents accepted by {@link Builder.file}. */
export type FileContents =
  | { type: "text"; data: string }
  | { type: "binary"; data: Uint8Array }
  | { type: "json"; data: unknown };

/** Starting point for all times in the in-memory FS */
export const TimeSeed: Temporal.Instant = DEFAULT_INSTANT;

/**
 * Seeds an {@link InMemoryFS} with files and directories.
 *
 * Every call creates missing parent directories along the path, so entries
 * can be seeded in any order without pre-creating the tree. Seeding the same
 * path twice throws: duplicates in test setup are bugs, not work requests.
 *
 * The builder and the built {@link InMemoryFS} share the same backing store,
 * so entries can keep being added after {@link build}.
 */
export class Builder {
  readonly #store: InMemoryStore = new InMemoryStore();

  /** The backing store, usable to inspect or extend what was seeded. */
  get store(): InMemoryStore {
    return this.#store;
  }

  /**
   * Creates a directory at `path`, reusing any existing directory.
   *
   * @throws {@link VortexError} when a path component blocks the tree.
   */
  dir(path: QualifiedPath): Builder {
    const ensured = this.#store.ensureDirectory(path);
    if (!ensured.ok) throwSeedFailure(ensured.failure);
    return this;
  }

  /**
   * Creates a file at `path` with the given contents.
   *
   * `text` contents are encoded as UTF-8, `json` contents are serialized
   * first. `status` overrides individual timestamps; unset fields fall back
   * to {@link TimeSeed}.
   *
   * @throws {@link VortexError} when a path component blocks the tree or the
   *   target path is already occupied.
   */
  file(path: QualifiedPath, contents: FileContents, status?: Partial<StatusTime>): Builder {
    const ensured = this.#store.ensureDirectory(path.parent());
    if (!ensured.ok) throwSeedFailure(ensured.failure);

    const node: FileNode = {
      type: "file",
      id: this.#store.nextId(),
      name: path.basename,
      times: Builder.#seedTimes(status),
      contents: Builder.#toBinaryData(contents),
    };

    const attached = this.#store.attach(path, node);
    if (!attached.ok) throwSeedFailure(attached.failure);
    return this;
  }

  /**
   * Returns an {@link InMemoryFS} operating on the entries seeded so far.
   * The builder remains usable and keeps seeding into the same store.
   */
  build(): InMemoryFS {
    return new InMemoryFS(this.#store);
  }

  static #seedTimes(status?: Partial<StatusTime>): StatusTime {
    return {
      accessTime: status?.accessTime ?? TimeSeed,
      modifiedTime: status?.modifiedTime ?? TimeSeed,
      changeTime: status?.changeTime ?? TimeSeed,
      creationTime: status?.creationTime ?? TimeSeed,
    };
  }

  static #toBinaryData(contents: FileContents): Uint8Array {
    if (contents.type === "binary") {
      return contents.data;
    } else if (contents.type === "text") {
      return new TextEncoder().encode(contents.data);
    } else if (contents.type === "json") {
      const text = JSON.stringify(contents.data);
      return new TextEncoder().encode(text);
    } else {
      const _: never = contents;
      throw new Error("Unknown content type");
    }
  }
}

/**
 * Turns store failure data into a thrown {@link VortexError}: the builder is
 * seed-time convenience code, setup mistakes should fail loudly.
 */
function throwSeedFailure(failure: WalkFailure): never {
  const path = failure.path.value;
  switch (failure.type) {
    case "missing-entry":
      throw new VortexError(`Seed path '${path}' does not exist`, {
        kind: "fs:not-found",
        path,
      });
    case "not-a-directory":
      throw new VortexError(`Seed path '${path}' is not a directory`, {
        kind: "fs:not-a-directory",
        path,
      });
    case "not-empty":
      throw new VortexError(`Seed path '${path}' is not empty`, {
        kind: "fs:directory-not-empty",
        path,
      });
    case "no-parent":
      throw new VortexError(`Seed path '${path}' cannot receive children`, {
        kind: "fs:not-found",
        path,
      });
    case "target-exists":
      throw new VortexError(`Seed path '${path}' already exists`, {
        kind: "fs:already-exists",
        path,
      });
    case "symlink-loop":
      throw new VortexError(`Symlink loop while seeding '${path}'`, {
        kind: "os:generic",
        originalCode: "ELOOP",
      });
  }
}

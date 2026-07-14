/**
 * Catalog of every error kind Vortex knows how to produce and classify.
 *
 * This map only contains kinds that clear one bar: something in the codebase
 * actually branches on that specific kind to do something categorically
 * different (a different UI flow, a different retry decision, a different
 * message). A raw OS/POSIX code that only ever varies a message string or
 * gets lumped into a generic "is this retryable" bucket does not get its own
 * kind, it becomes payload data (`originalCode`, `diagnosis`) on whichever
 * coarser kind actually matches. See `fs:*`/`os:generic`/`http:generic` below
 * for what that collapse looks like in practice.
 *
 * The kinds declared here fall into two categories:
 *
 * - **Mechanical** (`fs:*`, `http:*`, `os:*`): filesystem, network, and OS
 *   failures.
 * - **Domain-generic**: Vortex business concepts that apply
 *   uniformly no matter which subsystem is running (`user-canceled`,
 *   `data-invalid`, etc). These are also the kinds backing the 10
 *   `vortex-api` compatibility classes third-party extensions already use,
 *   so they live here for API stability as well as universality.
 *
 * Everything else, errors specific to one subsystem does not belong in this
 * file. It gets added via TypeScript declaration merging, right next to
 * wherever it's thrown:
 *
 * ```typescript
 * declare module "@vortex/shared/errors" {
 *   interface VortexErrorKindMap {
 *     "load-order:validation-failed": { loadOrderEntryNames: string };
 *   }
 * }
 * ```
 */
export interface VortexErrorKindMap {
  /** An argument was invalid. */
  "argument-invalid": { argument: string };
  /** Input data failed validation. */
  "data-invalid": { field?: string };
  /** A required external interpreter/tool isn't installed. */
  "missing-interpreter": { url?: string };
  /** The requested feature isn't available. */
  "not-supported": { feature?: string };
  /** Code (not the user) canceled an operation. */
  "process-canceled": { extraInfo?: unknown };
  /** The user explicitly canceled an operation. */
  "user-canceled": { skipped: boolean };
  /** Initialization/configuration of a component failed. */
  "setup-error": { component?: string };
  /**
   * Generic "resource doesn't exist" at the application level.
   * Use `fs:not-found` instead for an OS-level missing file/directory.
   */
  "not-found": { resourceType?: string };
  /** A specific game could not be found/matched. */
  "game-not-found": { gameId?: string };
  /** Dependency rules produced a circular reference. Each inner array is one cycle's chain of names. */
  "cycle-error": { cycles: string[][] };

  // File System
  "fs:already-exists": FileSystemErrorData;
  "fs:directory-not-empty": FileSystemErrorData;
  "fs:no-permissions": FileSystemErrorData;
  "fs:no-space": FileSystemErrorData;
  "fs:not-a-directory": FileSystemErrorData;
  "fs:not-a-file": FileSystemErrorData;
  "fs:not-found": FileSystemErrorData;

  // HTTP.
  "http:bad-status": { url: string; statusCode: number };
  "http:precondition-failed": { url: string };
  "http:protocol-violation": { url: string };
  "http:timeout": { url: string };
  /** Catch-all for a failed request that isn't one of the above. */
  "http:generic": { url: string };

  // Downloads
  /** The downloaded content is an HTML page. */
  "download:is-html": { url: string };
  /** Resolving a download URL failed. */
  "download:resolver-error": {};

  // OS mechanical failures.
  /** The requested operation isn't available on this operating system. */
  "os:unsupported": {};
  /**
   * Catch-all for a recognized-but-otherwise-uncategorized OS-level failure
   * (hardware defects, filesystem corruption, quota limits, transient
   * resource exhaustion like EMFILE/EBUSY, generic network/TLS codes with no
   * request context). `originalCode` carries the raw code for logging and
   * message lookup; it is not meant to be branched on.
   */
  "os:generic": OsErrorData;

  /**
   * Nothing above matched. The parser/classifier that produced this
   * genuinely doesn't know what happened. Deliberately the only kind allowed
   * to be a true junk-drawer, everything else in this map earns its place by
   * being something code actually branches on.
   */
  unknown: Record<string, unknown>;
}

/** Payload shared by mechanical OS-level errors. */
type OsErrorData = {
  originalCode: string | number;
};

/** Payload for filesystem errors. */
type FileSystemErrorData = OsErrorData & {
  path: string;
};

/**
 * Union of every kind name currently known, derived from `VortexErrorKindMap`.
 * Grows automatically when any module augments the map via `declare module`,
 * no separate registration step needed.
 */
export type VortexErrorKind = keyof VortexErrorKindMap;

/**
 * Union of every possible `{ kind, ...payload }` shape, one member per entry
 * in `VortexErrorKindMap`. This is what `VortexError.data` actually holds:
 * a discriminated union keyed on `kind`, so narrowing on `data.kind` gives
 * you the correctly-typed payload for that specific kind.
 */
export type VortexErrorData = {
  [K in VortexErrorKind]: { kind: K } & VortexErrorKindMap[K];
}[VortexErrorKind];

/**
 * The one error class Vortex constructs. Identity lives in `data.kind`,
 * not in the class prototype, because prototype identity doesn't survive
 * every boundary Vortex has.
 *
 * `instanceof VortexError` still works for the narrow set of cases that need
 * it, but internal code should prefer checking `.data.kind`.
 */
export class VortexError<out K extends VortexErrorKind = VortexErrorKind> extends Error {
  /** Error data keyed on the error kind. */
  readonly data: { [P in K]: { kind: P } & VortexErrorKindMap[P] }[K];

  /**
   * Whether the root cause is transient (retrying may succeed without any
   * other change), e.g. too many open files, a resource temporarily busy.
   *
   * Only describes the root cause, not whether the specific operation that
   * failed is safe to retry, that's a decision for the caller.
   */
  readonly isTransient: boolean;

  /**
   * @param message Human-readable, display-ready message. No deferred
   *   template placeholders, resolve any context (paths, URLs) before
   *   constructing the error.
   * @param data The `{ kind, ...payload }` for this error. `kind` decides
   *   which payload shape TypeScript requires here.
   * @param meta.isTransient Whether the root cause is transient. Defaults to
   *   `false`; only set `true` when the classifier constructing this error
   *   actually knows the underlying cause is temporary.
   * @param meta.cause The underlying error/value this one wraps, if any.
   */
  constructor(
    message: string,
    data: { [P in K]: { kind: P } & VortexErrorKindMap[P] }[K],
    meta?: {
      isTransient?: boolean;
      cause?: unknown;
    },
  ) {
    super(message, { cause: meta?.cause });
    this.name = this.constructor.name;

    this.data = data;
    this.isTransient = meta?.isTransient ?? false;
  }
}

const MARK = Symbol.for("vortex.errors.VortexError");

interface TripwireRegistration {
  ctor: typeof VortexError;
  /** Where this copy of the module was loaded from, for the error message below. */
  origin: string;
}

/**
 * Best-effort "loaded from here" string for the tripwire's error message.
 * Deliberately stack-based rather than `import.meta.url`/`__filename`:
 * this package ships both ESM and CJS builds, and each of those only works
 * in one of the two module formats, `import.meta` throws in CJS output,
 * `__filename` doesn't exist in ESM. A captured stack works identically in
 * both, and in any JS runtime, at the cost of being a rough diagnostic
 * string rather than a precisely parsed path.
 */
const captureOrigin = (): string => {
  const stack = new Error().stack ?? "";
  // First line is the "Error" header, not a frame; the one after it is
  // wherever this module's own top-level code is executing from.
  const frame = stack.split("\n")[1]?.trim();
  return frame ?? "<unknown origin>";
};

const isTripwireRegistration = (value: unknown): value is TripwireRegistration =>
  typeof value === "object" &&
  value !== null &&
  "ctor" in value &&
  typeof value.ctor === "function" &&
  "origin" in value &&
  typeof value.origin === "string";

const existingRaw = (globalThis as Record<symbol, unknown>)[MARK];
const existing = isTripwireRegistration(existingRaw) ? existingRaw : undefined;

if (existing !== undefined && existing.ctor !== VortexError) {
  throw new Error(
    "Duplicate @vortex/shared error module detected in this process. " +
      "A package is bundling @vortex/shared directly instead of going " +
      "through vortex-api, or @src/main's build is inlining it.\n" +
      `First instance loaded at: ${existing.origin}\n` +
      `This instance loaded at:  ${captureOrigin()}`,
  );
}

if (existing === undefined) {
  (globalThis as Record<symbol, unknown>)[MARK] = {
    ctor: VortexError,
    origin: captureOrigin(),
  } satisfies TripwireRegistration;
}

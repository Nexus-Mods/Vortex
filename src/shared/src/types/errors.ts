import { VortexError } from "../errors/base";

export type DownloadErrorPayload =
  | { code: "cancellation" }
  | { code: "network-error"; url: URL }
  | { code: "network-timeout"; url: URL }
  | { code: "network-bad-status"; url: URL; statusCode: number }
  | { code: "precondition-failed"; url: URL }
  | { code: "protocol-violation"; url: URL }
  | { code: "is-html"; url: URL }
  | { code: "fs-error"; path: string }
  | { code: "resolver-error" };

export class DownloadError extends Error {
  readonly payload: DownloadErrorPayload;

  constructor(payload: DownloadErrorPayload, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "DownloadError";
    this.payload = payload;
  }

  public get code(): DownloadErrorPayload["code"] {
    return this.payload.code;
  }
}

/**
 * Unlike {@link DownloadErrorPayload}, `url` rides as a string: an upload error
 * is thrown in main and crosses to the renderer through the generic error
 * serializer, which copies the payload verbatim. A `URL` instance is not
 * structured-cloneable, so it would fail the IPC hop.
 */
export type UploadErrorPayload =
  | { code: "cancellation" }
  | { code: "network-error"; url: string }
  | { code: "network-timeout"; url: string }
  | { code: "network-bad-status"; url: string; statusCode: number }
  | { code: "protocol-violation"; url: string }
  | { code: "fs-error"; path: string };

export class UploadError extends Error {
  readonly payload: UploadErrorPayload;

  constructor(payload: UploadErrorPayload, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "UploadError";
    this.payload = payload;
  }

  public get code(): UploadErrorPayload["code"] {
    return this.payload.code;
  }
}

export interface ReportableError {
  message: string;
  title?: string;
  subtitle?: string;
  code?: string;
  details?: string;
  stack?: string;
  extension?: string;
  path?: string;
  allowReport?: boolean;
  attachLog?: boolean;
  process?: "main" | "renderer";
}

function captureStackTrace<T extends Error>(
  self: T,
  constructor?: new (...args: never[]) => T,
): void {
  if ("captureStackTrace" in Error && typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(self, constructor);
  }
}

/**
 * @public
 * @deprecated Use `VortexError` directly
 */
export class UserCanceled extends VortexError<"user-canceled"> {
  public skipped: boolean;

  constructor(skipped?: boolean) {
    super("canceled by user", { kind: "user-canceled", skipped: skipped ?? false });
    this.skipped = skipped ?? false;
  }
}

/**
 * @public
 * @deprecated Use `VortexError` directly
 */
export class DataInvalid extends VortexError<"data-invalid"> {
  constructor(message: string) {
    super(message, { kind: "data-invalid" });
  }
}

/**
 * @public
 * @deprecated Use `VortexError` directly
 */
export class NotSupportedError extends VortexError<"not-supported"> {
  constructor() {
    super("Not supported", { kind: "not-supported" });
  }
}

export class CleanupFailedException extends Error {
  private mErrorObject: Error;
  constructor(error: Error) {
    super("Cleanup process has failed");
    this.name = this.constructor.name;
    this.mErrorObject = error;
  }

  public get errorObject(): Error {
    return this.mErrorObject;
  }
}

export class ServiceTemporarilyUnavailable extends Error {
  constructor(service: string) {
    super(`${service} service is temporarily unavailable. Please try again later.`);
    this.name = this.constructor.name;
  }
}

export class UnsupportedOperatingSystem extends Error {
  constructor() {
    super("Not supported on current Operating System");
    this.name = this.constructor.name;
  }
}

export class InsufficientDiskSpace extends Error {
  constructor(mountPoint: string) {
    super(`The partition "${mountPoint}" has insufficient space.`);
    this.name = this.constructor.name;
  }
}

/**
 * @public
 * @deprecated Use `VortexError` directly
 */
export class ProcessCanceled extends VortexError<"process-canceled"> {
  constructor(message: string, extraInfo?: unknown) {
    super(message, { kind: "process-canceled", extraInfo });
  }

  public get extraInfo(): unknown {
    return this.data.extraInfo;
  }
}

/**
 * @public
 * @deprecated Use `VortexError` directly
 */
export class ArgumentInvalid extends VortexError<"argument-invalid"> {
  constructor(argument: string) {
    super(`Invalid argument: "${argument}"`, { kind: "argument-invalid", argument });
  }
}

export class MissingDependency extends Error {
  constructor() {
    super("Dependency is missing");
    this.name = this.constructor.name;
  }
}

export class DocumentsPathMissing extends Error {
  constructor() {
    super("Failed to query the current user's documents folder");
    this.name = this.constructor.name;
  }
}

/**
 * @public
 * @deprecated Use `VortexError` directly
 */
export class SetupError extends VortexError<"setup-error"> {
  constructor(message: string, component?: string) {
    super(message, { kind: "setup-error", component });
  }

  public get component(): string | undefined {
    return this.data.component;
  }
}

export class TemporaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class HTTPError extends Error {
  private mCode: number;
  private mMessage: string;
  private mURL: string;
  constructor(statusCode: number, message: string, url: string) {
    super(`HTTP (${statusCode}) - ${message}`);
    this.name = this.constructor.name;
    this.mCode = statusCode;
    this.mMessage = message;
    this.mURL = url;
  }

  public get statusCode(): number {
    return this.mCode;
  }

  public get statusMessage(): string {
    return this.mMessage;
  }

  public get url(): string {
    return this.mURL;
  }
}

/**
 * @public
 * @deprecated Use `VortexError` directly
 */
export class MissingInterpreter extends VortexError<"missing-interpreter"> {
  constructor(message: string, url?: string) {
    super(message, { kind: "missing-interpreter", url });
  }

  public get url(): string | undefined {
    return this.data.url;
  }
}

/**
 * @public
 * @deprecated Use `VortexError` directly
 */
export class NotFound extends VortexError<"not-found"> {
  constructor(what: string) {
    super(`Not found: "${what}"`, { kind: "not-found", resourceType: what });
  }
}

export class StalledError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = this.constructor.name;
  }
}

export class TimeoutError extends Error {
  constructor() {
    super("Operation timed out");
    this.name = this.constructor.name;
  }
}

/**
 * these errors we report but don't allow to be reported to us
 */
export class ThirdPartyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class SelfCopyCheckError extends Error {
  constructor(src: string, dest: string, ino: bigint) {
    super(`Source "${src}" and destination "${dest}" are the same file (id "${ino}").`);
    this.name = this.constructor.name;
  }
}

export class ArchiveBrokenError extends Error {
  private mFileName: string | undefined;
  constructor(fileNameOrMessage: string, message?: string) {
    if (message == null) {
      // Single argument: it's just a message
      super(`Archive is broken: ${fileNameOrMessage}`);
      this.mFileName = undefined;
    } else {
      super(`Archive is broken: ${message}`);
      this.mFileName = fileNameOrMessage;
    }
    this.name = this.constructor.name;
  }

  public get fileName(): string | undefined {
    return this.mFileName;
  }
}

export class AlreadyDownloaded extends Error {
  private mFileName: string;
  private mId: string | undefined;
  constructor(fileName: string, id?: string) {
    super("File already downloaded");
    captureStackTrace(this, AlreadyDownloaded);
    this.name = this.constructor.name;
    this.mFileName = fileName;
    this.mId = id;
  }

  public get fileName(): string {
    return this.mFileName;
  }

  public get downloadId(): string | undefined {
    return this.mId;
  }

  public set downloadId(id: string) {
    this.mId = id;
  }
}

export class DownloadIsHTML extends Error {
  private mUrl: string;
  constructor(inputUrl: string) {
    super("");
    this.name = this.constructor.name;
    this.mUrl = inputUrl;
  }

  public get url(): string {
    return this.mUrl;
  }
}

/**
 * @public
 * @deprecated Use `VortexError` directly
 */
export class CycleError extends VortexError<"cycle-error"> {
  constructor(cycles: string[][]) {
    super("Rules contain cycles", { kind: "cycle-error", cycles });
  }

  public get cycles(): string[][] {
    return this.data.cycles;
  }
}

/**
 * @public
 * @deprecated Use `VortexError` directly
 */
export class GameNotFound extends VortexError<"game-not-found"> {
  constructor(search: string) {
    super("Not in Steam library", { kind: "game-not-found", gameId: search });
  }

  public get search(): string {
    return this.data.gameId;
  }
}

/**
 * Class-identity check that also survives the IPC boundary. An error that
 * crossed the wire is rebuilt as a plain `Error` (its prototype is lost), so
 * `instanceof` fails — but `error-serialization` preserves the original type on
 * `err.name` (falling back to `constructor.name`), so we match on either. Any
 * custom payload is carried across as own-enumerable properties and reattached,
 * so callers reading those fields still work on a rehydrated instance.
 */
export function isErrorOfType<T extends Error>(
  err: unknown,
  ctor: new (...args: never[]) => T,
): err is T {
  return err instanceof ctor || (err instanceof Error && err.name === ctor.name);
}

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
  constructor?: new (...args: unknown[]) => T,
): void {
  if (
    "captureStackTrace" in Error &&
    typeof Error.captureStackTrace === "function"
  ) {
    Error.captureStackTrace(self, constructor);
  }
}

export class UserCanceled extends Error {
  public skipped: boolean;

  constructor(skipped?: boolean) {
    super("canceled by user");
    this.skipped = skipped ?? false;
  }
}

export class DataInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotSupportedError extends Error {
  constructor() {
    super("Not supported");
    captureStackTrace(this, NotSupportedError);

    this.name = this.constructor.name;
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
    super(
      `${service} service is temporarily unavailable. Please try again later.`,
    );
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

export class ProcessCanceled extends Error {
  private mExtraInfo: unknown;
  constructor(message: string, extraInfo?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.mExtraInfo = extraInfo;
  }

  public get extraInfo(): any {
    return this.mExtraInfo;
  }
}

export class ArgumentInvalid extends Error {
  constructor(argument: string) {
    super(`Invalid argument: "${argument}"`);
    this.name = this.constructor.name;
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

export class SetupError extends Error {
  private mComponent: string | undefined;
  constructor(message: string, component?: string) {
    super(message);
    this.name = this.constructor.name;
    this.mComponent = component;
  }

  public get component(): string | undefined {
    return this.mComponent;
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

export class MissingInterpreter extends Error {
  private mURL: string | undefined;
  constructor(message: string, url?: string) {
    super(message);
    this.name = this.constructor.name;
    this.mURL = url;
  }

  public get url(): string | undefined {
    return this.mURL;
  }
}

export class NotFound extends Error {
  constructor(what: string) {
    super(`Not found: "${what}"`);
    this.name = this.constructor.name;
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
    super(
      `Source "${src}" and destination "${dest}" are the same file (id "${ino}").`,
    );
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

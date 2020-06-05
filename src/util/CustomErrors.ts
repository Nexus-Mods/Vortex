export class NotSupportedError extends Error {
  constructor() {
    super('Not supported');
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
  }
}

export class CleanupFailedException extends Error {
  private mErrorObject: Error;
  constructor(error: Error) {
    super('Cleanup process has failed');
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
    super('Not supported on current Operating System');
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
  private mExtraInfo: any;
  constructor(message: string, extraInfo?: any) {
    super(message);
    this.name = this.constructor.name;
    this.mExtraInfo = extraInfo;
  }

  public get extraInfo() {
    return this.mExtraInfo;
  }
}

export class DataInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ArgumentInvalid extends Error {
  constructor(argument: string) {
    super(`Invalid argument: ${argument}`);
    this.name = this.constructor.name;
  }
}

export class UserCanceled extends Error {
  constructor() {
    super('canceled by user');
    this.name = this.constructor.name;
  }
}

export class MissingDependency extends Error {
  constructor() {
    super('Dependency is missing');
    this.name = this.constructor.name;
  }
}

export class DocumentsPathMissing extends Error {
  constructor() {
    super('Failed to query the current user\'s documents folder');
    this.name = this.constructor.name;
  }
}

export class SetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
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
  private mURL: string;
  constructor(message: string, url?: string) {
    super(message);
    this.name = this.constructor.name;
    this.mURL = url;
  }

  public get url(): string {
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
  constructor() {
    super('Operation stalled');
    this.name = this.constructor.name;
  }
}

export class TimeoutError extends Error {
  constructor() {
    super('Operation timed out');
    this.name = this.constructor.name;
  }
}

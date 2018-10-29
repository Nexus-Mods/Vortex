export class NotSupportedError extends Error {
  constructor() {
    super('Not supported');
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
  }
}

export class ProcessCanceled extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class DataInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UserCanceled extends Error {
  constructor() {
    super('canceled by user');
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
  private mBody: string;
  constructor(statusCode: number, message: string, body: string) {
    super(`HTTP (${statusCode}) - ${message}`);
    this.name = this.constructor.name;
    this.mBody = body;
  }

  public get body(): string {
    return this.mBody;
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

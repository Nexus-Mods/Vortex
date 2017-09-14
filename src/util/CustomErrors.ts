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

export class UserCanceled extends Error {
  constructor() {
    super('canceled by user');
    this.name = this.constructor.name;
  }
}

export class HTTPError extends Error {
  constructor(statusCode: number, message: string) {
    super(`HTTP (${statusCode}) - ${message}`);
    this.name = this.constructor.name;
  }
}

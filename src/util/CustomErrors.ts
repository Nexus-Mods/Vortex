export class NotSupportedError extends Error {
  constructor() {
    super('Not supported');
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
  }
}

export class UserCanceled extends Error {
  constructor() {
    super('canceled by user');
    this.name = this.constructor.name;
  }
}

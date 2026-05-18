/**
 * ESP parsing error types.
 * Property names and codes match the legacy native addon for backward compatibility.
 */

export class InvalidFileError extends Error {
  override readonly name = "InvalidFileError";
  readonly code = "EINVAL";
  readonly path: string;

  constructor(message: string, filePath: string) {
    super(message);
    this.path = filePath;
  }
}

export class InvalidRecordError extends Error {
  override readonly name = "InvalidRecordError";
  readonly code = "EINVAL";
  readonly path: string;

  constructor(message: string, filePath: string) {
    super(message);
    this.path = filePath;
  }
}

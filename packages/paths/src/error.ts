export class PathError extends Error {
  path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = this.constructor.name;
    this.path = path;
  }
}

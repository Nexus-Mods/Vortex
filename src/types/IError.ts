export interface IError {
  message: string;
  title?: string;
  details?: string;
  stack?: string;
  extension?: string;
  path?: string;
}

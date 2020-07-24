export interface IError {
  message: string;
  title?: string;
  subtitle?: string;
  details?: string;
  stack?: string;
  extension?: string;
  path?: string;
  allowReport?: boolean;
}

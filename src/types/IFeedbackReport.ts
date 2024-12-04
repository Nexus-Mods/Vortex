// feedback-report event handler expects this structure.
import { IError } from './IError';
import { IErrorContext } from './IErrorContext';
export interface IFeedbackReport {
  title: string;
  message: string;
  files: string[];
  sourceProcess?: string;
  reporterProcess?: string;
  labels?: string[];
  context?: IErrorContext;
  error?: IError;
  hash?: string;
  callback?: (err: Error, response?: any) => void;
}
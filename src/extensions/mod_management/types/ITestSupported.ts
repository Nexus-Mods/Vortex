import * as Promise from 'bluebird';

export interface ISupportedResult {
  supported: boolean;
  requiredFiles: string[];
}

export interface ITestSupported {
  (files: string[]): Promise<ISupportedResult>;
}

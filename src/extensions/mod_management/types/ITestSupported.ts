import * as Promise from 'bluebird';

export interface ISupportedResult {
  supported: boolean;
  requiredFiles: string[];
}

export type ITestSupported = (files: string[]) => Promise<ISupportedResult>;

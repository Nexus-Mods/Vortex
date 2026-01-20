import type PromiseBB from "bluebird";

export interface ISupportedResult {
  supported: boolean;
  requiredFiles: string[];
}

export interface ITestSupportedDetails {
  hasXmlConfigXML?: boolean;
  hasCSScripts?: boolean;
}

export type TestSupported = (
  files: string[],
  gameId: string,
  archivePath?: string,
  details?: ITestSupportedDetails,
) => PromiseBB<ISupportedResult>;

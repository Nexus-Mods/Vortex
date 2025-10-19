// TODO: Remove Bluebird import - using native Promise;

export interface ISupportedResult {
  supported: boolean;
  requiredFiles: string[];
}

export type TestSupported =
  (files: string[], gameId: string, archivePath?: string) => Promise<ISupportedResult>;

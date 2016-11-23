export interface IInstallContext {
  startInstallCB: (id: string, archivePath: string, destinationPath: string) =>
      void;
  finishInstallCB: (id: string, success: boolean) => void;
  progressCB: (percent: number, file: string) => void;
  reportError: (message: string, details?: string) => void;
}

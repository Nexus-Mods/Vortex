declare namespace Electron {
  export interface Dialog {
    // Add overloads that accept nullable windows (since this is allowed and we use this)
    showCertificateTrustDialog(
      window: Electron.BaseWindow | null,
      options: Electron.CertificateTrustDialogOptions,
    ): Promise<void>;
    showMessageBox(
      window: Electron.BaseWindow | null,
      options: Electron.MessageBoxOptions,
    ): Promise<Electron.MessageBoxReturnValue>;
    showMessageBoxSync(
      window: Electron.BaseWindow | null,
      options: Electron.MessageBoxSyncOptions,
    ): number;
    showOpenDialog(
      window: Electron.BaseWindow | null,
      options: Electron.OpenDialogOptions,
    ): Promise<Electron.OpenDialogReturnValue>;
    showOpenDialogSync(
      window: Electron.BaseWindow | null,
      options: Electron.OpenDialogSyncOptions,
    ): string[] | undefined;
    showSaveDialog(
      window: Electron.BaseWindow | null,
      options: Electron.SaveDialogOptions,
    ): Promise<Electron.SaveDialogReturnValue>;
    showSaveDialogSync(
      window: Electron.BaseWindow | null,
      options: Electron.SaveDialogSyncOptions,
    ): string | undefined;
  }
}

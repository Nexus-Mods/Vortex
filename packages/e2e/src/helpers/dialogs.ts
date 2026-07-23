import type { ElectronApplication } from "@playwright/test";

export async function stubOpenDialog(
  vortexApp: ElectronApplication,
  filePath: string,
): Promise<void> {
  await vortexApp.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [path] });
  }, filePath);
}

import { extractIconToFile } from "icon-extract";

function extractExeIcon(exePath: string, destPath: string): Promise<void> {
  if (process.platform === "win32") {
    return new Promise<void>((resolve, reject) => {
      try {
        extractIconToFile(exePath, destPath);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
  // Non-Windows: no icon extraction available
  return Promise.reject(new Error("icon extraction is only supported on Windows"));
}

export default extractExeIcon;

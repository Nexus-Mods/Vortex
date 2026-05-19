import { extractIconToFile } from "icon-extract";

async function extractExeIcon(exePath: string, destPath: string): Promise<void> {
  await extractIconToFile(exePath, destPath);
}

export default extractExeIcon;

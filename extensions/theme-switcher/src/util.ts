import { readdir } from "node:fs/promises";
import * as path from "path";

import { util } from "@nexusmods/vortex-api";

export function themesPath(): string {
  return path.join(util.getVortexPath("userData"), "themes");
}

/** List all theme directories: bundled themes plus the user's themes folder. */
export async function listThemeDirs(): Promise<string[]> {
  const baseDirs = [path.join(__dirname, "themes"), themesPath()];
  const lists = await Promise.all(
    baseDirs.map(async (baseDir) => {
      try {
        const entries = await readdir(baseDir, { withFileTypes: true });
        return entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => path.join(baseDir, entry.name));
      } catch {
        // an unreadable base dir contributes no themes
        return [];
      }
    }),
  );
  return lists.flat();
}

interface IFont {
  family: string;
}

// Get available system fonts - runs directly in renderer process
export function getAvailableFonts(): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fontScanner = require("font-scanner");
  return fontScanner
    .getAvailableFonts()
    .then((fonts: IFont[]) =>
      Array.from(
        new Set<string>([
          "Inter",
          "Roboto",
          "Montserrat",
          "BebasNeue",
          ...(fonts || []).map((font) => font.family).sort(),
        ]),
      ),
    );
}

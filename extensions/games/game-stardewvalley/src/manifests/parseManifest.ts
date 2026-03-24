/**
 * Parses Stardew/SMAPI `manifest.json` files from disk.
 */
import { parse } from "relaxed-json";
import { fs, util } from "vortex-api";

import type { ISDVModManifest } from "../types";

/** Reads and parses a SMAPI manifest file from disk. */
export async function parseManifest(
  manifestFilePath: string,
): Promise<ISDVModManifest> {
  const manifestData = await fs.readFileAsync(manifestFilePath, {
    encoding: "utf-8",
  });
  const manifest: ISDVModManifest = parse(
    util.deBOM(manifestData),
  ) as ISDVModManifest;
  if (!manifest) {
    throw new util.DataInvalid("Manifest file is invalid");
  }
  return manifest;
}

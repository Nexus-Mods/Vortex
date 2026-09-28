import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { IPlugins } from "../types/IPlugins";
import { findInvalidPlugins } from "./findInvalidPlugins";
import toPluginId from "./toPluginId";

// The on-disk name deliberately uses mixed case: doSort passes path.basename(filePath)
// (original case) while pluginList is keyed by toPluginId (lowercase).
const FILE_NAME = "Origins Of Forest - 3D Forest Grass Smaller.esp";

describe("findInvalidPlugins", () => {
  let dir: string;
  let filePath: string;
  let pluginList: IPlugins;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "find-invalid-"));
    filePath = path.join(dir, FILE_NAME);
    // a header this short fails ESPFile.open with InvalidFileError ("file incomplete",
    // code EINVAL) - the same condition libloot reports as "not a valid plugin"
    fs.writeFileSync(filePath, Buffer.from("TES4"));
    pluginList = {
      [toPluginId(FILE_NAME)]: {
        modId: "",
        filePath,
        isNative: false,
        warnings: {},
        deployed: true,
      },
    };
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("flags an invalid plugin passed as its lowercase id (plugin-details shape)", async () => {
    const invalid = await findInvalidPlugins([toPluginId(FILE_NAME)], pluginList, "skyrimse");
    expect([...invalid]).toEqual([toPluginId(FILE_NAME)]);
  });

  it("flags an invalid plugin passed as its original-case file name (sort shape)", async () => {
    const invalid = await findInvalidPlugins([FILE_NAME], pluginList, "skyrimse");
    expect([...invalid]).toEqual([FILE_NAME]);
  });
});

import * as path from "path";

import Bluebird from "bluebird";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { copyAsync, log } = vi.hoisted(() => ({
  copyAsync: vi.fn(),
  log: vi.fn(),
}));

vi.mock("@nexusmods/vortex-api", () => ({
  fs: { copyAsync },
  log,
}));

import { copyGameSettings } from "./copyGameSettings";

describe("copyGameSettings", () => {
  beforeEach(() => {
    copyAsync.mockReset();
    log.mockReset();
  });

  it("falls back to the live ini when the .base file does not exist", async () => {
    const sourcePath = "/proton/Documents/My Games/Oblivion";
    const destinationPath = "/profiles/oblivion";
    const baseSource = path.join(sourcePath, "Oblivion.ini.base");
    const liveSource = path.join(sourcePath, "Oblivion.ini");
    const destination = path.join(destinationPath, "Oblivion.ini");

    copyAsync
      .mockImplementationOnce(() => Bluebird.reject({ code: "ENOENT" }))
      .mockImplementation(() => Bluebird.resolve());

    await copyGameSettings(
      sourcePath,
      destinationPath,
      [{ name: "Oblivion.ini", optional: false }],
      "GloPro",
    );

    expect(copyAsync).toHaveBeenNthCalledWith(1, baseSource, destination, { noSelfCopy: true });
    expect(copyAsync).toHaveBeenNthCalledWith(2, liveSource, destination, { noSelfCopy: true });
  });

  it("uses the .base file when it exists", async () => {
    const sourcePath = "/proton/Documents/My Games/Oblivion";
    const destinationPath = "/profiles/oblivion";
    const baseSource = path.join(sourcePath, "Oblivion.ini.base");
    const destination = path.join(destinationPath, "Oblivion.ini");

    copyAsync.mockImplementation(() => Bluebird.resolve());

    await copyGameSettings(
      sourcePath,
      destinationPath,
      [{ name: "Oblivion.ini", optional: false }],
      "GloPro",
    );

    expect(copyAsync).toHaveBeenCalledTimes(1);
    expect(copyAsync).toHaveBeenCalledWith(baseSource, destination, { noSelfCopy: true });
  });
});

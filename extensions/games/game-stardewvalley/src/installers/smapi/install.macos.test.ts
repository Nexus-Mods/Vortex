/**
 * Tests the current macOS stub so the error message stays clear.
 */
import { beforeEach, describe, expect, test } from "vitest";

import { smapiInstallerArchiveEntries } from "./fixtures/archiveListings";
import { extractFullMock, resetVortexApiMocks } from "./fixtures/vortexApi.mock";
import { installSMAPI, macosSMAPIPlatform } from "./index";

describe("installers/smapi installSMAPI (macOS)", () => {
  beforeEach(() => {
    resetVortexApiMocks();
  });

  test("fails with a clear macOS stub message", async () => {
    // Act + assert: reject with the stub message.
    await expect(
      installSMAPI(() => "/game", smapiInstallerArchiveEntries, "/staging", macosSMAPIPlatform),
    ).rejects.toThrow("SMAPI automatic installation on macOS is not implemented yet");

    // Assert: do not unpack anything.
    expect(extractFullMock).not.toHaveBeenCalled();
  });
});

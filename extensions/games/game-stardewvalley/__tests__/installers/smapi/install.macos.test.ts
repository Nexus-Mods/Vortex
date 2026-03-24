import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  installSMAPI,
  macosSMAPIPlatform,
} from "../../../src/installers/smapi";
import { smapiInstallerArchiveEntries } from "./fixtures/archiveListings";
import { extractFullMock } from "../../../__mocks__/vortex-api";

describe("installers/smapi installSMAPI (macOS stub variant)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("fails with a clear stub message", async () => {
    await expect(
      installSMAPI(
        () => "/game",
        smapiInstallerArchiveEntries,
        "/staging",
        macosSMAPIPlatform,
      ),
    ).rejects.toThrow(
      "SMAPI automatic installation on macOS is not implemented yet",
    );

    expect(extractFullMock).not.toHaveBeenCalled();
  });
});

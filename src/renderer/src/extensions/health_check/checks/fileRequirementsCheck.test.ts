import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock the dependencies so the check can be exercised in isolation without
// pulling in heavy modules or real Nexus/profile state.
vi.mock("../../profile_management/selectors", () => ({
  activeProfile: vi.fn(),
}));
vi.mock("../../nexus_integration/selectors", () => ({
  isLoggedIn: vi.fn(),
}));
vi.mock("../utils/runFileLevelRequirements", () => ({
  runFileLevelRequirements: vi.fn(),
}));
vi.mock("../../../logging", () => ({ log: vi.fn() }));

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { isLoggedIn } from "../../nexus_integration/selectors";
import { activeProfile } from "../../profile_management/selectors";
import type { IProfile } from "../../profile_management/types/IProfile";
import { runFileLevelRequirements } from "../utils/runFileLevelRequirements";
import { checkFileRequirements, FILE_REQUIREMENTS_CHECK_ID } from "./fileRequirementsCheck";

// TODO: once runFileLevelRequirements resolves real requirements, add tests that
// exercise the resolution itself (candidate grouping, satisfied vs missing, error
// handling) rather than only the guard clauses and metadata pass-through below.

const api = { getState: () => ({}) } as unknown as IExtensionApi;

const mockActiveProfile = vi.mocked(activeProfile);
const mockIsLoggedIn = vi.mocked(isLoggedIn);
const mockRun = vi.mocked(runFileLevelRequirements);

describe("checkFileRequirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveProfile.mockReturnValue({ gameId: "skyrimse" } as unknown as IProfile);
    mockIsLoggedIn.mockReturnValue(true);
    mockRun.mockResolvedValue({
      gameId: "skyrimse",
      modsChecked: 0,
      fileRequirements: {},
      errors: [],
    });
  });

  test("passes without resolving when there is no active profile", async () => {
    mockActiveProfile.mockReturnValue(undefined);
    const result = await checkFileRequirements(api);
    expect(result.checkId).toBe(FILE_REQUIREMENTS_CHECK_ID);
    expect(result.status).toBe("passed");
    expect(mockRun).not.toHaveBeenCalled();
  });

  test("passes without resolving when no game is selected", async () => {
    mockActiveProfile.mockReturnValue({ gameId: undefined } as unknown as IProfile);
    const result = await checkFileRequirements(api);
    expect(result.status).toBe("passed");
    expect(result.message).toContain("No game selected");
    expect(mockRun).not.toHaveBeenCalled();
  });

  test("passes without resolving when not logged in", async () => {
    mockIsLoggedIn.mockReturnValue(false);
    const result = await checkFileRequirements(api);
    expect(result.status).toBe("passed");
    expect(mockRun).not.toHaveBeenCalled();
  });

  test("passes and includes metadata when there are no requirements", async () => {
    const result = await checkFileRequirements(api);
    expect(result.status).toBe("passed");
    expect(result.metadata).toMatchObject({ fileRequirements: {} });
    expect(mockRun).toHaveBeenCalledOnce();
  });

  test("warns when requirements are found", async () => {
    mockRun.mockResolvedValue({
      gameId: "skyrimse",
      modsChecked: 1,
      fileRequirements: {
        "100": {
          sourceFileUID: "100",
          sourceModName: "Source Mod",
          requirements: [
            {
              kind: "missing",
              requirementId: "dep-1",
              alternatives: [
                {
                  fileUID: "200",
                  modName: "Mod A",
                  fileName: "a.zip",
                  version: "1.0",
                  adultContent: false,
                },
              ],
            },
          ],
        },
      },
      errors: [],
    });
    const result = await checkFileRequirements(api);
    expect(result.status).toBe("warning");
  });
});

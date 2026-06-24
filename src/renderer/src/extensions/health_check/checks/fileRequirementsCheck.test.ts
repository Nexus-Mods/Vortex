import { beforeEach, describe, expect, test, vi } from "vitest";

// The file-requirements provider is tested end-to-end: real ports + resolver +
// report mapping, with only the *endpoints* (v3 batch client, mod-details) and
// the *input* (installed files) mocked. We feed installed files + canned endpoint
// responses and assert the health-check reports that come out.
vi.mock("../utils/installedFiles", () => ({
  gatherInstalledFiles: vi.fn(),
  makeInstalledFileHydrator: vi.fn(),
}));
vi.mock("../../nexus_integration/nexusV3Client", () => ({
  createVortexNexusV3Client: vi.fn(),
}));
vi.mock("../utils/modDetails", () => ({ getModDetails: vi.fn() }));
vi.mock("../../nexus_integration/selectors", () => ({ isLoggedIn: vi.fn() }));
vi.mock("../../profile_management/selectors", () => ({ activeProfile: vi.fn() }));
vi.mock("../../../logging", () => ({ log: vi.fn() }));

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { createVortexNexusV3Client } from "../../nexus_integration/nexusV3Client";
import { isLoggedIn } from "../../nexus_integration/selectors";
import { activeProfile } from "../../profile_management/selectors";
import type { IProfile } from "../../profile_management/types/IProfile";
import type { IFileRequirementsCheckMetadata, IInstalledFile, IModDetails } from "../types";
import {
  gatherInstalledFiles,
  makeInstalledFileHydrator,
  type IInstalledFileRef,
} from "../utils/installedFiles";
import { getModDetails } from "../utils/modDetails";
import { checkFileRequirements } from "./fileRequirementsCheck";

const mockActiveProfile = vi.mocked(activeProfile);
const mockIsLoggedIn = vi.mocked(isLoggedIn);
const mockGather = vi.mocked(gatherInstalledFiles);
const mockHydrator = vi.mocked(makeInstalledFileHydrator);
const mockCreateClient = vi.mocked(createVortexNexusV3Client);
const mockGetModDetails = vi.mocked(getModDetails);

const api = { getState: () => ({}) } as unknown as IExtensionApi;

/** A raw v3 dependency-candidate row (snake_case, as the endpoint returns it). */
interface V3Candidate {
  source_version_id: string;
  definition_id: string;
  mod_file_id: string;
  version_id: string;
  position: string;
  category: string;
  mod_status: string;
  mod_id: string;
}

/** Installed file metadata the resolver needs (its update-group "chain" + mod). */
interface VersionFixture {
  chain: string;
  modId: string;
  name?: string;
  version?: string;
}

function ref(fileUID: string, enabled = true): IInstalledFileRef {
  return { fileUID, modId: `vortex-${fileUID}`, enabled };
}

function installedFile(fileUID: string, enabled: boolean): IInstalledFile {
  return {
    modId: `vortex-${fileUID}`,
    fileUID,
    modName: `Mod ${fileUID}`,
    fileName: `${fileUID}.zip`,
    version: "1.0",
    adultContent: false,
    enabled,
  };
}

function candidate(
  over: Partial<V3Candidate> &
    Pick<V3Candidate, "source_version_id" | "version_id" | "mod_file_id">,
): V3Candidate {
  return {
    definition_id: "def-1",
    position: "1.0",
    category: "main",
    mod_status: "published",
    mod_id: "mod-uid",
    ...over,
  };
}

/** A fake v3 client backed by in-memory version + candidate fixtures. */
function fakeClient(versions: Record<string, VersionFixture>, candidates: V3Candidate[]) {
  return {
    getModFileVersionsBatch: vi.fn(async (ids: string[]) =>
      ids
        .filter((id) => versions[id] !== undefined)
        .map((id) => ({
          id,
          mod_id: versions[id].modId,
          mod_file_id: versions[id].chain,
          name: versions[id].name ?? `name-${id}`,
          version: versions[id].version ?? "1.0",
        })),
    ),
    getModFileVersionDependencyCandidatesBatch: vi.fn(
      async (ids: readonly string[], page: number, pageSize: number) => {
        const rows = candidates.filter((c) => ids.includes(c.source_version_id));
        return { candidates: rows, meta: { page, page_size: pageSize, total_count: rows.length } };
      },
    ),
  };
}

/** Wire the mocks for one resolution run and return the metadata it produces. */
async function runWith(opts: {
  refs: IInstalledFileRef[];
  versions: Record<string, VersionFixture>;
  candidates: V3Candidate[];
  modDetails?: IModDetails[];
}): Promise<IFileRequirementsCheckMetadata | undefined> {
  mockGather.mockResolvedValue(opts.refs);
  mockHydrator.mockReturnValue((fileUID: string) => {
    const found = opts.refs.find((r) => r.fileUID === fileUID);
    return found ? installedFile(fileUID, found.enabled) : undefined;
  });
  mockCreateClient.mockReturnValue(
    fakeClient(opts.versions, opts.candidates) as unknown as ReturnType<
      typeof createVortexNexusV3Client
    >,
  );
  mockGetModDetails.mockResolvedValue(opts.modDetails ?? []);

  const result = await checkFileRequirements(api);
  return result.metadata as IFileRequirementsCheckMetadata | undefined;
}

describe("checkFileRequirements / guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveProfile.mockReturnValue({ gameId: "skyrimse" } as unknown as IProfile);
    mockIsLoggedIn.mockReturnValue(true);
  });

  test("passes without resolving when there is no active profile", async () => {
    mockActiveProfile.mockReturnValue(undefined);
    const result = await checkFileRequirements(api);
    expect(result.status).toBe("passed");
    expect(mockGather).not.toHaveBeenCalled();
  });

  test("passes without resolving when no game is selected", async () => {
    mockActiveProfile.mockReturnValue({ gameId: undefined } as unknown as IProfile);
    const result = await checkFileRequirements(api);
    expect(result.status).toBe("passed");
    expect(result.message).toContain("No game selected");
    expect(mockGather).not.toHaveBeenCalled();
  });

  test("passes without resolving when not logged in", async () => {
    mockIsLoggedIn.mockReturnValue(false);
    const result = await checkFileRequirements(api);
    expect(result.status).toBe("passed");
    expect(mockGather).not.toHaveBeenCalled();
  });

  test("passes without hitting the endpoints when nothing is installed", async () => {
    mockGather.mockResolvedValue([]);
    const result = await checkFileRequirements(api);
    expect(result.status).toBe("passed");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});

describe("checkFileRequirements / resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveProfile.mockReturnValue({ gameId: "skyrimse" } as unknown as IProfile);
    mockIsLoggedIn.mockReturnValue(true);
  });

  // NOTE: fileDependencyPorts caches by UID across runs, so each case below uses
  // distinct UIDs to stay independent.

  test("reports a missing dependency with its recommended download", async () => {
    const metadata = await runWith({
      refs: [ref("ms_src")],
      versions: {
        ms_src: { chain: "ms_srcChain", modId: "ms_srcMod" },
        ms_cand: { chain: "ms_candChain", modId: "ms_candMod", name: "SkyUI", version: "5.2" },
      },
      candidates: [
        candidate({
          source_version_id: "ms_src",
          definition_id: "ms_def",
          version_id: "ms_cand",
          mod_file_id: "ms_candChain",
          mod_id: "ms_candMod",
        }),
      ],
      modDetails: [{ modUID: "ms_candMod", modName: "SkyUI", adultContent: false }],
    });

    const reqs = metadata?.fileRequirements["ms_src"]?.requirements;
    expect(reqs).toHaveLength(1);
    expect(reqs?.[0]).toMatchObject({ kind: "missing", requirementId: "ms_def" });
    expect(reqs?.[0].kind === "missing" && reqs[0].alternatives[0]).toMatchObject({
      fileUID: "ms_cand",
      modName: "SkyUI",
      version: "5.2",
    });
  });

  test("reports a wrong (out-of-range) version that is installed and enabled", async () => {
    const metadata = await runWith({
      // wi_old shares the dependency chain but is NOT a listed candidate.
      refs: [ref("wi_src"), ref("wi_old")],
      versions: {
        wi_src: { chain: "wi_srcChain", modId: "wi_srcMod" },
        wi_old: { chain: "wi_depChain", modId: "wi_depMod" },
        wi_new: { chain: "wi_depChain", modId: "wi_depMod", name: "SKSE", version: "2.2" },
      },
      candidates: [
        candidate({
          source_version_id: "wi_src",
          definition_id: "wi_def",
          version_id: "wi_new",
          mod_file_id: "wi_depChain",
          mod_id: "wi_depMod",
        }),
      ],
      modDetails: [{ modUID: "wi_depMod", modName: "SKSE", adultContent: false }],
    });

    const [req] = metadata?.fileRequirements["wi_src"]?.requirements ?? [];
    expect(req).toMatchObject({
      kind: "wrong-version-installed",
      installedFile: { fileUID: "wi_old" },
    });
    expect(req.kind === "wrong-version-installed" && req.alternatives[0].fileUID).toBe("wi_new");
  });

  test("reports a wrong version enabled while the correct version is installed-but-disabled", async () => {
    const metadata = await runWith({
      refs: [ref("we_src"), ref("we_old", true), ref("we_correct", false)],
      versions: {
        we_src: { chain: "we_srcChain", modId: "we_srcMod" },
        we_old: { chain: "we_depChain", modId: "we_depMod" },
        we_correct: { chain: "we_depChain", modId: "we_depMod" },
      },
      candidates: [
        candidate({
          source_version_id: "we_src",
          definition_id: "we_def",
          version_id: "we_correct",
          mod_file_id: "we_depChain",
          mod_id: "we_depMod",
        }),
      ],
    });

    const [req] = metadata?.fileRequirements["we_src"]?.requirements ?? [];
    expect(req).toMatchObject({
      kind: "wrong-version-enabled",
      enabledFile: { fileUID: "we_old", enabled: true },
      correctFile: { fileUID: "we_correct", enabled: false },
    });
  });

  test("reports nothing when the enabled installed version satisfies the dependency", async () => {
    const metadata = await runWith({
      refs: [ref("ok_src"), ref("ok_dep")],
      versions: {
        ok_src: { chain: "ok_srcChain", modId: "ok_srcMod" },
        ok_dep: { chain: "ok_depChain", modId: "ok_depMod" },
      },
      candidates: [
        candidate({
          source_version_id: "ok_src",
          definition_id: "ok_def",
          version_id: "ok_dep",
          mod_file_id: "ok_depChain",
          mod_id: "ok_depMod",
        }),
      ],
    });

    expect(metadata?.fileRequirements).toEqual({});
  });

  test("derives a warning status and counts when requirements are found", async () => {
    mockGather.mockResolvedValue([ref("w_src")]);
    mockHydrator.mockReturnValue((fileUID) => installedFile(fileUID, true));
    mockCreateClient.mockReturnValue(
      fakeClient(
        {
          w_src: { chain: "w_srcChain", modId: "w_srcMod" },
          w_cand: { chain: "w_candChain", modId: "w_candMod" },
        },
        [
          candidate({
            source_version_id: "w_src",
            definition_id: "w_def",
            version_id: "w_cand",
            mod_file_id: "w_candChain",
            mod_id: "w_candMod",
          }),
        ],
      ) as unknown as ReturnType<typeof createVortexNexusV3Client>,
    );
    mockGetModDetails.mockResolvedValue([
      { modUID: "w_candMod", modName: "Dep", adultContent: false },
    ]);

    const result = await checkFileRequirements(api);
    expect(result.status).toBe("warning");
    expect(result.message).toContain("1 file requirements");
  });
});

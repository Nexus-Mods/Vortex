import { createNexusV3Client, type components } from "@vortex/nexus-api-v3";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { makeArchiveManifestFile, makeModFileVersionDetail } from "@/test-utils/builders";

import { fetchArchiveFiles, type ArchiveManifestFile } from "./archiveManifests";

vi.mock("@/logging", () => ({ log: vi.fn() }));

const MANIFEST_URL = "https://mod-file-manifests.test/10/91/b1/skyui";

const fetchMock = vi.fn<typeof globalThis.fetch>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Serves the version batch endpoint and each manifest from the given responses. */
function serve(versions: Response, manifests: Record<string, Response> = {}): void {
  fetchMock.mockImplementation((input) => {
    const url = input instanceof Request ? input.url : String(input);
    return Promise.resolve(manifests[url] ?? versions);
  });
}

const versionsResponse = (versions: components["schemas"]["ModFileVersionDetail"][]) =>
  json({ data: { versions } });

const manifestResponse = (files: ArchiveManifestFile[]) => json({ version: 1, files });

const client = () => createNexusV3Client({ baseUrl: "https://api.nexusmods.test/v3" });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchArchiveFiles", () => {
  test("reads each file version's archive files from its manifest, by file name", async () => {
    const version = makeModFileVersionDetail({ manifest_url: MANIFEST_URL });
    serve(versionsResponse([version]), {
      [MANIFEST_URL]: manifestResponse([
        makeArchiveManifestFile({ file_path: "SkyUI_SE.esp", file_size: 2388 }),
        makeArchiveManifestFile({
          file_path: "interface/skyui/config.txt",
          file_size: 120,
          file_hashes: { MD5: "config-md5" },
        }),
        makeArchiveManifestFile({
          file_path: "Optional/interface/skyui/config.txt",
          file_size: 140,
          file_hashes: { MD5: "optional-config-md5" },
        }),
      ]),
    });

    const archiveFiles = await fetchArchiveFiles(client(), [version.id]);

    expect(Object.fromEntries(archiveFiles.get(version.id) ?? [])).toEqual({
      "SkyUI_SE.esp": [
        { path: "SkyUI_SE.esp", size: 2388, md5: "b65a92135fb46c4bf17b8faa2f80089c" },
      ],
      "config.txt": [
        { path: "interface/skyui/config.txt", size: 120, md5: "config-md5" },
        { path: "Optional/interface/skyui/config.txt", size: 140, md5: "optional-config-md5" },
      ],
    });
  });

  test("leaves out a file version without a manifest", async () => {
    const version = makeModFileVersionDetail({ manifest_url: null });
    serve(versionsResponse([version]));

    const archiveFiles = await fetchArchiveFiles(client(), [version.id]);

    expect(archiveFiles.size).toBe(0);
  });

  test("leaves out a file version whose manifest is not served yet", async () => {
    const version = makeModFileVersionDetail({ manifest_url: MANIFEST_URL });
    serve(versionsResponse([version]), { [MANIFEST_URL]: json({}, 404) });

    const archiveFiles = await fetchArchiveFiles(client(), [version.id]);

    expect(archiveFiles.size).toBe(0);
  });

  test("returns no archive files when the file versions cannot be looked up", async () => {
    serve(json({ title: "Unauthorized", status: 401 }, 401));

    const archiveFiles = await fetchArchiveFiles(client(), [makeModFileVersionDetail().id]);

    expect(archiveFiles.size).toBe(0);
  });
});

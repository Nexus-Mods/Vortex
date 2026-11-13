import { beforeEach, describe, expect, it, vi } from "vitest";

import { getModFiles, getModFileVersions } from "./getModFileVersions";

const token = "exampleUserToken";
const signal = vi.fn() as unknown as AbortController["signal"];

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(
    async (_url: string, _options: RequestInit): Promise<Response> =>
      Promise.resolve({} as Response),
  ),
}));

global.fetch = mockFetch;

/** Stands in for a fetch Response; only the bits these functions read are set. */
const respond = (body: unknown, { ok = true, status = 200, statusText = "Success" } = {}) =>
  ({ ok, status, statusText, json: () => Promise.resolve(body) }) as unknown as Response;

describe("getModFileVersions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the versions from the response", async () => {
    const versions = [{ id: "1", version: "1.0" }];
    mockFetch.mockResolvedValue(respond({ data: { versions } }));

    await expect(getModFileVersions("file-uid", token, signal)).resolves.toEqual(versions);
  });

  it("requests the versions for the given file", async () => {
    mockFetch.mockResolvedValue(respond({ data: { versions: [] } }));

    await getModFileVersions("file-uid", token, signal);

    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.nexusmods.com/v3/mod-files/file-uid/versions",
    );
  });

  it("sends the token as a bearer header when there is one", async () => {
    mockFetch.mockResolvedValue(respond({ data: { versions: [] } }));

    await getModFileVersions("file-uid", token, signal);

    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${token}`);
  });

  it("omits the authorization header when there is no token", async () => {
    mockFetch.mockResolvedValue(respond({ data: { versions: [] } }));

    await getModFileVersions("file-uid", undefined, signal);

    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("asks the user to sign in again on a 401", async () => {
    mockFetch.mockResolvedValue(respond({}, { ok: false, status: 401 }));

    await expect(getModFileVersions("file-uid", token, signal)).rejects.toThrow(
      /log out and back in/,
    );
  });

  it("surfaces the API's own error detail on other failures", async () => {
    mockFetch.mockResolvedValue(
      respond(
        { status: 404, title: "Not Found", detail: "No such file" },
        { ok: false, status: 404, statusText: "Not Found" },
      ),
    );

    await expect(getModFileVersions("file-uid", token, signal)).rejects.toThrow(/No such file/);
  });
});

describe("getModFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the files from the response", async () => {
    const modFiles = [{ id: "1", name: "Main file" }];
    mockFetch.mockResolvedValue(respond({ data: { mod_files: modFiles } }));

    await expect(getModFiles("mod-uid", token, signal)).resolves.toEqual(modFiles);
  });

  it("requests the files for the given mod", async () => {
    mockFetch.mockResolvedValue(respond({ data: { mod_files: [] } }));

    await getModFiles("mod-uid", token, signal);

    expect(mockFetch.mock.calls[0][0]).toBe("https://api.nexusmods.com/v3/mods/mod-uid/files");
  });

  it("asks the user to sign in again on a 401", async () => {
    mockFetch.mockResolvedValue(respond({}, { ok: false, status: 401 }));

    await expect(getModFiles("mod-uid", token, signal)).rejects.toThrow(/log out and back in/);
  });
});

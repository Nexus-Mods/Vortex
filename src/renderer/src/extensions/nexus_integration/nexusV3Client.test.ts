import { V3ApiError } from "@vortex/nexus-api-v3";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { createVortexNexusV3Client } from "./nexusV3Client";
import { getAccessToken } from "./util/oauthSession";

vi.mock("../../util/application", () => ({ getApplication: () => ({ version: "0.0.0-test" }) }));
vi.mock("./util/oauthSession", () => ({ getAccessToken: vi.fn() }));

const getToken = vi.mocked(getAccessToken);

function makeApi(stateToken: string | undefined): IExtensionApi {
  const nexus =
    stateToken === undefined
      ? {}
      : { OAuthCredentials: { token: stateToken, refreshToken: "refresh", fingerprint: "fp" } };
  return { getState: () => ({ confidential: { account: { nexus } } }) } as unknown as IExtensionApi;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ok = () => json({ data: { mods: [] } }, 200);
const unauthorized = () => json({ title: "Unauthorized", status: 401 }, 401);

const fetchMock = vi.fn<typeof globalThis.fetch>();

/** The Request openapi-fetch handed to fetch on the nth call. */
function sentRequest(n: number): Request {
  const call = fetchMock.mock.calls[n];
  if (call === undefined) throw new Error(`fetch was not called ${n + 1} times`);
  return call[0] as Request;
}

beforeEach(() => {
  fetchMock.mockReset();
  getToken.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createVortexNexusV3Client oauth", () => {
  test("sends the token the session hands out rather than the one in state", async () => {
    getToken.mockResolvedValue("fresh");
    fetchMock.mockResolvedValueOnce(ok());

    const api = makeApi("stale");
    await createVortexNexusV3Client(api).getModsBatch(["1"]);

    expect(getToken).toHaveBeenCalledWith(api, undefined);
    expect(sentRequest(0).headers.get("Authorization")).toBe("Bearer fresh");
  });

  test("retries a 401 once with a forced refresh of the rejected token", async () => {
    getToken.mockResolvedValueOnce("expired").mockResolvedValueOnce("renewed");
    fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(ok());

    const api = makeApi("expired");
    const result = await createVortexNexusV3Client(api).getModsBatch(["1", "2"]);

    expect(result).toEqual([]);
    expect(getToken).toHaveBeenNthCalledWith(2, api, "expired");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentRequest(1).headers.get("Authorization")).toBe("Bearer renewed");
    // the retry carries the original body
    await expect(sentRequest(1).text()).resolves.toEqual(await sentRequest(0).text());
  });

  test("lets the 401 through when the refresh yields the same token", async () => {
    getToken.mockResolvedValue("dead");
    fetchMock.mockResolvedValueOnce(unauthorized());

    const pending = createVortexNexusV3Client(makeApi("dead")).getModsBatch(["1"]);

    await expect(pending).rejects.toBeInstanceOf(V3ApiError);
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("lets the 401 through when the refresh is refused", async () => {
    getToken.mockResolvedValueOnce("dead").mockRejectedValueOnce(new Error("invalid_grant"));
    fetchMock.mockResolvedValueOnce(unauthorized());

    const pending = createVortexNexusV3Client(makeApi("dead")).getModsBatch(["1"]);

    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("does not retry a 401 for an anonymous request", async () => {
    getToken.mockResolvedValue(undefined);
    fetchMock.mockResolvedValueOnce(unauthorized());

    const pending = createVortexNexusV3Client(makeApi(undefined)).getModsBatch(["1"]);

    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(sentRequest(0).headers.has("Authorization")).toBe(false);
  });
});

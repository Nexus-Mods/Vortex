import jwt from "jsonwebtoken";
import { describe, expect, vi } from "vitest";

import { makeUserInfo } from "@/test-utils/builders";
import type { IHarnessFixtures } from "@/test-utils/harnessTest";
import { test } from "@/test-utils/harnessTest";

import { clearOAuthCredentials, setOAuthCredentials } from "../actions/account";
import type * as oauthModule from "./oauth";
import { requestTokenRefresh } from "./oauth";
import { getAccessToken } from "./oauthSession";

// util.ts (pulled in by the harness) builds the real OAuth class, so mock only the refresh
vi.mock("./oauth", async (importOriginal) => ({
  ...(await importOriginal<typeof oauthModule>()),
  requestTokenRefresh: vi.fn(),
}));

const refreshMock = vi.mocked(requestTokenRefresh);

/**
 * An access token as the site issues it, expiring `secondsLeft` from now. Nothing verifies the
 * signature; the claims are read as they are.
 */
const makeToken = (secondsLeft: number, id = "t") =>
  jwt.sign(
    {
      application_id: 1,
      exp: Math.floor(Date.now() / 1000) + secondsLeft,
      fingerprint: `fp-${id}`,
      iat: Math.floor(Date.now() / 1000),
      iss: "nexusmods",
      jti: id,
      sub: "7",
      user: {
        group_id: 1,
        id: 7,
        joined: 0,
        membership_roles: [],
        other_group_ids: "",
        permissions: {},
        premium_expiry: 0,
        age_verified: true,
        username: "Ada",
      },
    },
    "not-verified-here",
  );

const reply = (accessToken: string, refreshToken = "refresh-2") => ({
  access_token: accessToken,
  refresh_token: refreshToken,
  token_type: "Bearer" as const,
  expires_in: 3600,
  scope: "openid",
});

/** The token endpoint's answer to a refresh token it no longer recognises. */
const invalidGrant = () =>
  Object.assign(new Error('Invalid request: "invalid_grant"'), { code: "invalid_grant" });

type Harness = ReturnType<IHarnessFixtures["makeApi"]>;

function logIn(harness: Harness, token: string, refreshToken = "refresh-1") {
  harness.api.store.dispatch(setOAuthCredentials(token, refreshToken, "fp-1"));
}

const storedCredentials = (harness: Harness) =>
  harness.getState().confidential.account["nexus"].OAuthCredentials;

describe("getAccessToken", () => {
  test("hands out the current token while it is fresh", async ({ makeApi }) => {
    const harness = makeApi();
    const token = makeToken(3600);
    logIn(harness, token);

    await expect(getAccessToken(harness.api)).resolves.toBe(token);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  test("is undefined without an OAuth session", async ({ makeApi }) => {
    const harness = makeApi();
    harness.api.store.dispatch(clearOAuthCredentials(null));

    await expect(getAccessToken(harness.api)).resolves.toBeUndefined();
  });

  test("refreshes ahead of expiry and stores the new pair", async ({ makeApi }) => {
    const harness = makeApi();
    logIn(harness, makeToken(10));
    const renewed = makeToken(3600, "renewed");
    refreshMock.mockResolvedValueOnce(reply(renewed));

    await expect(getAccessToken(harness.api)).resolves.toBe(renewed);

    expect(refreshMock).toHaveBeenCalledWith("refresh-1");
    expect(storedCredentials(harness)).toEqual({
      token: renewed,
      refreshToken: "refresh-2",
      fingerprint: "fp-renewed",
    });
  });

  test("shares one refresh between callers who need it at the same time", async ({ makeApi }) => {
    const harness = makeApi();
    logIn(harness, makeToken(10));
    const renewed = makeToken(3600, "renewed");
    let release: (value: ReturnType<typeof reply>) => void = () => undefined;
    refreshMock.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));

    const first = getAccessToken(harness.api);
    const second = getAccessToken(harness.api);
    release(reply(renewed));

    await expect(Promise.all([first, second])).resolves.toEqual([renewed, renewed]);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  test("hands out the current token when a refresh fails for a passing reason", async ({
    makeApi,
  }) => {
    const harness = makeApi({ userInfo: makeUserInfo({ name: "Ada" }) });
    const token = makeToken(10);
    logIn(harness, token);
    refreshMock.mockRejectedValueOnce(
      Object.assign(new Error("getaddrinfo ENOTFOUND users.nexusmods.com"), { code: "ENOTFOUND" }),
    );

    await expect(getAccessToken(harness.api)).resolves.toBe(token);

    expect(storedCredentials(harness)?.token).toBe(token);
    expect(harness.errorNotifications).toEqual([]);
  });

  test("forces a refresh for a rejected token while it is still the current one", async ({
    makeApi,
  }) => {
    const harness = makeApi();
    const token = makeToken(3600);
    logIn(harness, token);
    const renewed = makeToken(3600, "renewed");
    refreshMock.mockResolvedValueOnce(reply(renewed));

    await expect(getAccessToken(harness.api, token)).resolves.toBe(renewed);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  test("answers a rejected token that was already replaced with the current one", async ({
    makeApi,
  }) => {
    const harness = makeApi();
    const token = makeToken(3600);
    logIn(harness, token);

    await expect(getAccessToken(harness.api, "an-older-token")).resolves.toBe(token);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  test("signs the user out and rejects when the refresh is refused", async ({ makeApi }) => {
    const harness = makeApi({ userInfo: makeUserInfo({ name: "Ada" }) });
    const token = makeToken(3600);
    logIn(harness, token);
    refreshMock.mockRejectedValueOnce(invalidGrant());

    await expect(getAccessToken(harness.api, token)).rejects.toMatchObject({
      code: "invalid_grant",
    });

    expect(storedCredentials(harness)).toBeUndefined();
    expect(harness.getState().persistent["nexus"].userInfo).toBeUndefined();
    expect(harness.errorNotifications).toEqual([
      expect.objectContaining({ title: "Authentication failed, please log in again" }),
    ]);
  });

  test("does not resurrect a session that ended while the refresh was out", async ({ makeApi }) => {
    const harness = makeApi();
    logIn(harness, makeToken(10));
    let release: (value: ReturnType<typeof reply>) => void = () => undefined;
    refreshMock.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));

    const pending = getAccessToken(harness.api);
    logIn(harness, makeToken(3600, "other"), "refresh-other");
    release(reply(makeToken(3600, "renewed")));

    await expect(pending).resolves.toBe(storedCredentials(harness)?.token);
    expect(storedCredentials(harness)?.refreshToken).toBe("refresh-other");
  });
});

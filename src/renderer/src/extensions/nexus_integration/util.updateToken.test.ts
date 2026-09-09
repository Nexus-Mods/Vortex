import jwt from "jsonwebtoken";
import { describe, expect, vi } from "vitest";

import { makeUserInfo } from "@/test-utils/builders";
import { test } from "@/test-utils/harnessTest";
import { ProcessCanceled } from "@/util/CustomErrors";

import { MEMBERSHIP_ROLE, updateToken } from "./util";

/**
 * An access token as the site issues it. Only the payload matters here: nothing verifies the
 * signature, the account details are read straight out of the claims.
 */
const makeToken = (roles: string[] = []) =>
  jwt.sign(
    {
      application_id: 1,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      iss: "nexusmods",
      jti: "a-token-id",
      sub: "7",
      user: {
        group_id: 1,
        id: 7,
        joined: 0,
        membership_roles: roles,
        other_group_ids: "",
        permissions: {},
        premium_expiry: 0,
        age_verified: true,
        username: "Ada",
      },
    },
    "not-verified-here",
  );

const credentials = (roles: string[] = []) => ({
  fingerprint: "a-fingerprint",
  refreshToken: "a-refresh-token",
  token: makeToken(roles),
});

/** A nexus connection whose credential handover fails the way `err` says. */
const makeNexus = (err: Error) => {
  const setOAuthCredentials = vi.fn().mockRejectedValue(err);
  const getUserInfo = vi.fn();

  return { nexus: { setOAuthCredentials, getUserInfo } as never, setOAuthCredentials, getUserInfo };
};

/**
 * setOAuthCredentials keeps the credentials it was handed and then looks the avatar up over the
 * network, so an offline session fails that call with a live login. Treating it as a rejected
 * login used to clear userInfo while leaving the credentials in place, which reads as signed in
 * to the header and signed out to the user: no account menu, and no login button either.
 */
describe("updateToken while offline", () => {
  test("keeps the known account", async ({ makeApi }) => {
    const harness = makeApi({ userInfo: makeUserInfo({ name: "Ada" }) });
    const { nexus } = makeNexus(new ProcessCanceled("network disconnected: setOAuthCredentials"));

    await updateToken(harness.api, nexus, credentials());

    expect(harness.getState().persistent["nexus"].userInfo?.name).toBe("Ada");
    expect(harness.errorNotifications).toEqual([]);
  });

  test("falls back to the account the token describes when nothing is stored", async ({
    makeApi,
  }) => {
    const harness = makeApi({ userInfo: undefined });
    const socketError = Object.assign(new Error("getaddrinfo ENOTFOUND api.nexusmods.com"), {
      code: "ENOTFOUND",
    });
    const { nexus } = makeNexus(socketError);

    await updateToken(harness.api, nexus, credentials([MEMBERSHIP_ROLE.premium]));

    expect(harness.getState().persistent["nexus"].userInfo).toMatchObject({
      name: "Ada",
      userId: 7,
      isPremium: true,
    });
    expect(harness.errorNotifications).toEqual([]);
  });

  test("still clears the account when the site rejects the credentials", async ({ makeApi }) => {
    const harness = makeApi({ userInfo: makeUserInfo({ name: "Ada" }) });
    const { nexus } = makeNexus(new Error("Unauthorized"));

    await updateToken(harness.api, nexus, credentials());

    expect(harness.getState().persistent["nexus"].userInfo).toBeUndefined();
    expect(harness.errorNotifications).toEqual([
      expect.objectContaining({ title: "Authentication failed, please log in again" }),
    ]);
  });
});

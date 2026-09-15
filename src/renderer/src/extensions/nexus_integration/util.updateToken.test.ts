import { NexusError } from "@nexusmods/nexus-api";
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

const refused = (statusCode: number) =>
  new NexusError("Unauthorized", statusCode, "https://api.nexusmods.com", "unauthorized");

/**
 * setOAuthCredentials keeps the credentials it is handed and then looks the avatar up over the
 * network, so most of the ways that call can fail say nothing about the session. Only the site
 * turning the credentials down means the user has to log in again — and clearing the account on
 * anything else read as signed in to the header and signed out to the user: no account menu,
 * and no login button either.
 */
describe("updateToken", () => {
  describe("when the site refuses the login", () => {
    test.for([401, 403])("clears the account on %i", async (statusCode, { makeApi }) => {
      const harness = makeApi({ userInfo: makeUserInfo({ name: "Ada" }) });
      const { nexus } = makeNexus(refused(statusCode));

      await updateToken(harness.api, nexus, credentials());

      expect(harness.getState().persistent["nexus"].userInfo).toBeUndefined();
      expect(harness.errorNotifications).toEqual([
        expect.objectContaining({ title: "Authentication failed, please log in again" }),
      ]);
    });
  });

  describe("when the request just fails", () => {
    // the Disableable proxy stands in for every request while the network is down
    test("keeps the known account offline", async ({ makeApi }) => {
      const harness = makeApi({ userInfo: makeUserInfo({ name: "Ada" }) });
      const { nexus } = makeNexus(new ProcessCanceled("network disconnected: setOAuthCredentials"));

      await updateToken(harness.api, nexus, credentials());

      expect(harness.getState().persistent["nexus"].userInfo?.name).toBe("Ada");
      expect(harness.errorNotifications).toEqual([]);
    });

    test("keeps the known account when the site errors", async ({ makeApi }) => {
      const harness = makeApi({ userInfo: makeUserInfo({ name: "Ada" }) });
      const { nexus } = makeNexus(refused(500));

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
  });
});

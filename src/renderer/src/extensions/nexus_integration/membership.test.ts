import { beforeEach, describe, expect, vi } from "vitest";

import { makeApiUserInfo } from "@/test-utils/builders";
import { test } from "@/test-utils/harnessTest";
import type { IApiHarness } from "@/test-utils/harnessTypes";
import type { IState } from "@/types/IState";

import {
  ensureFreshMembership,
  refreshMembership,
  resetMembershipFreshness,
  scheduleMembershipRefresh,
} from "./membership";

/** The harness is signed in by default; this flips it to a signed-out account. */
const setSignedOut = (harness: IApiHarness) =>
  harness.setState((draft) => {
    draft.confidential = { account: { nexus: {} } } as IState["confidential"];
  });

const makeNexus = (getUserInfo = vi.fn().mockResolvedValue(makeApiUserInfo())) => ({
  nexus: { getUserInfo } as never,
  getUserInfo,
});

describe("membership freshness", () => {
  beforeEach(() => {
    resetMembershipFreshness();
  });

  describe("refreshMembership", () => {
    test("reads the membership into state", async ({ makeApi }) => {
      const harness = makeApi();
      const { nexus } = makeNexus();

      await expect(refreshMembership(harness.api, nexus)).resolves.toBe(true);

      expect(harness.getState().persistent["nexus"].userInfo).toMatchObject({ isPremium: true });
    });

    test("shares one request between concurrent callers", async ({ makeApi }) => {
      const harness = makeApi();
      const { nexus, getUserInfo } = makeNexus();

      await Promise.all([
        refreshMembership(harness.api, nexus),
        refreshMembership(harness.api, nexus),
        refreshMembership(harness.api, nexus),
      ]);

      expect(getUserInfo).toHaveBeenCalledTimes(1);
    });

    test("reports failure without leaving the request stuck", async ({ makeApi }) => {
      const harness = makeApi();
      const getUserInfo = vi.fn().mockRejectedValueOnce(new Error("network down"));
      const nexus = { getUserInfo } as never;

      await expect(refreshMembership(harness.api, nexus)).resolves.toBe(false);

      // the next caller gets a fresh attempt rather than the failed one
      getUserInfo.mockResolvedValue(makeApiUserInfo());
      await expect(refreshMembership(harness.api, nexus)).resolves.toBe(true);
    });
  });

  describe("ensureFreshMembership", () => {
    test("reads when nothing has been read yet", async ({ makeApi }) => {
      const harness = makeApi();
      const { nexus, getUserInfo } = makeNexus();

      await ensureFreshMembership(harness.api, nexus);

      expect(getUserInfo).toHaveBeenCalledTimes(1);
    });

    test("serves a recent read rather than asking again", async ({ makeApi }) => {
      const harness = makeApi();
      const { nexus, getUserInfo } = makeNexus();

      await ensureFreshMembership(harness.api, nexus);
      await ensureFreshMembership(harness.api, nexus);

      expect(getUserInfo).toHaveBeenCalledTimes(1);
    });

    test("asks again once the last read has gone stale", async ({ makeApi }) => {
      const harness = makeApi();
      const { nexus, getUserInfo } = makeNexus();

      await ensureFreshMembership(harness.api, nexus);
      resetMembershipFreshness();
      await ensureFreshMembership(harness.api, nexus);

      expect(getUserInfo).toHaveBeenCalledTimes(2);
    });

    test("holds off briefly after a failed read rather than retrying every call", async ({
      makeApi,
    }) => {
      const harness = makeApi();
      const getUserInfo = vi.fn().mockRejectedValue(new Error("network down"));
      const nexus = { getUserInfo } as never;

      await ensureFreshMembership(harness.api, nexus);
      await ensureFreshMembership(harness.api, nexus);

      expect(getUserInfo).toHaveBeenCalledTimes(1);
    });

    test("stays quiet for a logged-out user, who has no membership to read", async ({
      makeApi,
    }) => {
      const harness = makeApi();
      setSignedOut(harness);
      const { nexus, getUserInfo } = makeNexus();

      await ensureFreshMembership(harness.api, nexus);

      expect(getUserInfo).not.toHaveBeenCalled();
    });
  });

  describe("scheduleMembershipRefresh", () => {
    test("asks the extension to re-read, collapsing a burst into one request", ({ makeApi }) => {
      const harness = makeApi();
      const refresh = vi.fn();
      harness.api.events.on("refresh-user-info", refresh);

      scheduleMembershipRefresh(harness.api);
      scheduleMembershipRefresh(harness.api);
      scheduleMembershipRefresh(harness.api);

      expect(refresh).toHaveBeenCalledTimes(1);
    });

    test("stays quiet for a logged-out user", ({ makeApi }) => {
      const harness = makeApi();
      setSignedOut(harness);
      const refresh = vi.fn();
      harness.api.events.on("refresh-user-info", refresh);

      scheduleMembershipRefresh(harness.api);

      expect(refresh).not.toHaveBeenCalled();
    });
  });
});

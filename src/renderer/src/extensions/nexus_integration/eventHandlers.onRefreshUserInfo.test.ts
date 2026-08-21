import { describe, expect, vi } from "vitest";

import { test } from "@/test-utils/harnessTest";

import { onRefreshUserInfo } from "./eventHandlers";
import { refreshMembership } from "./membership";

// Importing eventHandlers reaches util/api, which builds Steam's singleton at module scope. On
// Linux that constructor resolves steam paths through getVortexPath, and module scope is before
// the setup file's ApplicationData stub is usable, so the import throws "Not yet initialized!"
// there while passing on Windows. Steam is the only module-scope getVortexPath caller on the path,
// and nothing here needs it.
vi.mock("@/util/Steam", () => ({ default: {} }));

// the read itself belongs to membership.test.ts; here it only matters whether it is reached
vi.mock("./membership", () => ({
  refreshMembership: vi.fn(() => Promise.resolve(true)),
  ensureFreshMembership: vi.fn(() => Promise.resolve()),
  scheduleMembershipRefresh: vi.fn(),
  trackMembershipReads: vi.fn(),
  resetMembershipFreshness: vi.fn(),
  HOVER_REFRESH_FLOOR: 0,
}));

const read = vi.mocked(refreshMembership);

/**
 * Several places raise `refresh-user-info` and not all of them check whether anyone is logged in,
 * so the guard lives in this handler rather than in refreshMembership, which is unconditional.
 * Without it a logged-out session asks the api for a membership it cannot have and the failure
 * surfaces as an error toast.
 */
describe("onRefreshUserInfo", () => {
  test("re-reads the membership while logged in", async ({ makeApi }) => {
    const harness = makeApi();
    read.mockClear();

    await onRefreshUserInfo({} as never, harness.api)();

    expect(read).toHaveBeenCalledTimes(1);
  });

  test("asks for nothing while logged out", async ({ makeApi }) => {
    const harness = makeApi();
    read.mockClear();
    harness.setState((draft) => {
      // IState types account as {} because the nexus slice is contributed by this extension;
      // dropping the whole account is what a logged-out session looks like to isLoggedIn
      draft.confidential.account = {};
    });

    await expect(onRefreshUserInfo({} as never, harness.api)()).resolves.toBeUndefined();

    expect(read).not.toHaveBeenCalled();
    expect(harness.errorNotifications).toEqual([]);
  });
});

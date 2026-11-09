import { describe, expect, vi } from "vitest";

import { test } from "@/test-utils/harnessTest";

import { onAPIKeyChanged, onOAuthTokenChanged } from "./eventHandlers";
import type * as nexusUtil from "./util";

// Importing eventHandlers reaches util/api, which builds Steam's singleton at module scope; see
// eventHandlers.onRefreshUserInfo.test.ts. Nothing here needs it.
vi.mock("@/util/Steam", () => ({ default: {} }));

// only whether the account's preferences are dropped matters here, not how the account is read
vi.mock("./util", async (importOriginal) => ({
  ...(await importOriginal<typeof nexusUtil>()),
  updateKey: vi.fn(),
  updateToken: vi.fn(() => Promise.resolve(true)),
  updateUserInfoFromRefreshedToken: vi.fn(),
}));

/** A client whose preferences cache can be watched being dropped. */
const makeNexus = () => {
  const clearPreferencesCache = vi.fn();
  return { nexus: { clearPreferencesCache } as never, clearPreferencesCache };
};

const credentials = (token: string) => ({ token, refreshToken: "refresh", fingerprint: "print" });

describe("dropping the cached preferences", () => {
  test("drops them when the session ends, however it ended", ({ makeApi }) => {
    const { nexus, clearPreferencesCache } = makeNexus();

    onOAuthTokenChanged(makeApi().api, nexus)(credentials("a"), undefined);

    expect(clearPreferencesCache).toHaveBeenCalledTimes(1);
  });

  test("drops them when an account logs in, so it never sees the last one's", ({ makeApi }) => {
    const { nexus, clearPreferencesCache } = makeNexus();

    onOAuthTokenChanged(makeApi().api, nexus)(undefined, credentials("b"));

    expect(clearPreferencesCache).toHaveBeenCalledTimes(1);
  });

  test("keeps them through a token refresh, which is still the same account", ({ makeApi }) => {
    const { nexus, clearPreferencesCache } = makeNexus();

    onOAuthTokenChanged(makeApi().api, nexus)(credentials("a"), credentials("a2"));

    expect(clearPreferencesCache).not.toHaveBeenCalled();
  });

  test("drops them when the API key changes", ({ makeApi }) => {
    const { nexus, clearPreferencesCache } = makeNexus();

    onAPIKeyChanged(makeApi().api, nexus)("old", "new");

    expect(clearPreferencesCache).toHaveBeenCalledTimes(1);
  });
});

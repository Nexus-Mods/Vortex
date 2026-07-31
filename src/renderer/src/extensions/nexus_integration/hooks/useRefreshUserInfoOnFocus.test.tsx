import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";

import { test } from "@/test-utils/harnessTest";
import type { IApiHarness } from "@/test-utils/harnessTypes";

import { resetMembershipFreshness } from "../membership";
import { useRefreshUserInfoOnFocus } from "./useRefreshUserInfoOnFocus";

afterEach(() => {
  cleanup();
});

// @testing-library/react v12 has no renderHook, so the hook is driven through a probe component
const Probe = ({ harness, enabled }: { harness: IApiHarness; enabled: boolean }) => {
  useRefreshUserInfoOnFocus(harness.api, enabled);
  return null;
};

const focusWindow = () => window.dispatchEvent(new Event("focus"));

/**
 * Only the listening is this hook's business: the debounce and the logged-out guard belong to the
 * shared scheduler, and are covered by membership.test.ts.
 */
describe("useRefreshUserInfoOnFocus", () => {
  beforeEach(() => {
    resetMembershipFreshness();
  });

  const arrange = (harness: IApiHarness, enabled = true) => {
    const refresh = vi.fn();
    harness.api.events.on("refresh-user-info", refresh);
    return { refresh, ...render(<Probe enabled={enabled} harness={harness} />) };
  };

  test("re-reads the membership when the window regains focus", ({ makeApi }) => {
    const { refresh } = arrange(makeApi());

    focusWindow();

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("does nothing while disabled", ({ makeApi }) => {
    const { refresh } = arrange(makeApi(), false);

    focusWindow();

    expect(refresh).not.toHaveBeenCalled();
  });

  test("stops listening once the page is left", ({ makeApi }) => {
    const { refresh, unmount } = arrange(makeApi());

    unmount();
    focusWindow();

    expect(refresh).not.toHaveBeenCalled();
  });
});

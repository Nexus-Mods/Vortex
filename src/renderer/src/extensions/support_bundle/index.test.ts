import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionContext } from "@/types/IExtensionContext";

const { startMock, stopMock, hasOAuthLoginMock, analyticsMock } = vi.hoisted(() => ({
  startMock: vi.fn(),
  stopMock: vi.fn(),
  hasOAuthLoginMock: vi.fn(),
  analyticsMock: vi.fn(),
}));

vi.mock("./util/feedbackReplay", () => ({
  startFeedbackReplay: startMock,
  stopFeedbackReplay: stopMock,
}));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ hasOAuthLogin: hasOAuthLoginMock }));
vi.mock("@/extensions/analytics/selectors", () => ({ isAnalyticsEnabled: analyticsMock }));
vi.mock("./views/FeedbackDialog", () => ({ FeedbackDialog: () => null }));
vi.mock("./views/SupportBundleDialog", () => ({ SupportBundleDialog: () => null }));

import init from "./index";

/** Runs the extension's init and start-up, and returns the state changes it listens to. */
const start = () => {
  const listeners = new Map<string, () => void>();
  let once: (() => void) | undefined;
  const context = {
    registerDialog: vi.fn(),
    once: (callback: () => void) => {
      once = callback;
    },
    api: {
      getState: () => ({}),
      onStateChange: (path: string[], callback: () => void) => {
        listeners.set(path.join("."), callback);
      },
    },
  } as unknown as IExtensionContext;

  init(context);
  once?.();
  return listeners;
};

beforeEach(() => {
  vi.clearAllMocks();
  hasOAuthLoginMock.mockReturnValue(true);
  analyticsMock.mockReturnValue(true);
});

describe("the feedback recording", () => {
  it("starts for a user logged in through OAuth who shares usage data", () => {
    start();

    expect(startMock).toHaveBeenCalledTimes(1);
    expect(stopMock).not.toHaveBeenCalled();
  });

  it.each([
    ["logged out, or on an old API key", false, true],
    ["not sharing usage data", true, false],
  ])("does not start for a user %s", (_case, loggedIn, analytics) => {
    hasOAuthLoginMock.mockReturnValue(loggedIn);
    analyticsMock.mockReturnValue(analytics);

    start();

    expect(startMock).not.toHaveBeenCalled();
  });

  it("stops, and forgets what it kept, once the user logs out or stops sharing usage data", () => {
    const listeners = start();

    hasOAuthLoginMock.mockReturnValue(false);
    listeners.get("confidential.account.nexus")!();
    expect(stopMock).toHaveBeenCalledTimes(1);

    hasOAuthLoginMock.mockReturnValue(true);
    listeners.get("confidential.account.nexus")!();
    expect(startMock).toHaveBeenCalledTimes(2);

    analyticsMock.mockReturnValue(false);
    listeners.get("settings.analytics.enabled")!();
    expect(stopMock).toHaveBeenCalledTimes(2);
  });
});

/**
 * Tests for the analytics extension's consent wiring: the tracker reads consent
 * from the store from init onwards, and clicking Yes in the consent dialog
 * still sends app_launched now that the tracker drops unconsented events.
 */
import { EventEmitter } from "node:events";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionContext } from "../../types/IExtensionContext";
import type { IValidateKeyDataV2 } from "../nexus_integration/types/IValidateKeyData";
import type * as TrackerModule from "./mixpanel/MixpanelAnalytics";

const mp = vi.hoisted(() => ({
  init: vi.fn(),
  identify: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  get_property: vi.fn(),
  track: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("mixpanel-browser", () => ({ default: mp }));
vi.mock("../../util/application", () => ({ getApplication: () => ({ version: "1.2.3" }) }));
vi.mock("@/util/nativeArch", () => ({ getCPUArch: () => "x64" }));
vi.mock("../../contexts/WindowContext", () => ({ isHidpiDisplay: () => false }));
vi.mock("../settings_interface/utils/zoom", () => ({ zoomFromState: () => 1 }));
vi.mock("../../util/selectors", () => ({
  activeGameId: () => undefined,
  activeProfileId: () => undefined,
}));
vi.mock("../nexus_integration/util", () => ({ nexusGamesProm: () => Promise.resolve() }));
vi.mock("./utils/storeGameVersionEvent", () => ({ emitStoreGameVersions: vi.fn() }));

const relaunching = vi.hoisted(() => ({ value: false }));
vi.mock("@/util/commandLine", () => ({ isRelaunching: () => relaunching.value }));

// The real tracker is a singleton whose startup queue closes for good, so the default export
// forwards to a fresh real instance per test.
const tracker = vi.hoisted((): { current?: TrackerModule.MixpanelAnalytics } => ({}));
vi.mock("./mixpanel/MixpanelAnalytics", async (importOriginal) => {
  const actual = await importOriginal<typeof TrackerModule>();
  const forward = new Proxy(
    {},
    {
      get: (_target, prop): unknown => {
        const value: unknown = Reflect.get(tracker.current, prop);
        return typeof value === "function" ? value.bind(tracker.current) : value;
      },
    },
  );
  return { ...actual, default: forward };
});

import init from "./index";
import AnalyticsMixpanel, { MixpanelAnalytics } from "./mixpanel/MixpanelAnalytics";

interface FakeDialogAction {
  label: string;
  action: () => void;
}

const savedUser = {
  userId: 42,
  isPremium: false,
  isSupporter: false,
  isLifetime: false,
} as IValidateKeyDataV2;

function makeContext(enabled: boolean | undefined, { loggedIn = true, restored = true } = {}) {
  const onceCallbacks: Array<() => void> = [];
  const state = {
    settings: {
      analytics: { enabled },
      update: { channel: "stable" },
      window: { useModernLayout: true },
    },
    confidential: {
      account: loggedIn ? { nexus: { OAuthCredentials: { token: "token" } } } : {},
    },
    persistent: { nexus: { userInfo: restored ? savedUser : undefined } },
  };
  // mirror the settings reducer for the one action the consent dialog dispatches
  const dispatch = vi.fn((action: { type: string; payload: boolean }) => {
    if (action.type === "SET_UPDATE_ANALYTICS") {
      state.settings.analytics.enabled = action.payload;
    }
  });
  let notification: { actions: Array<{ action: (dismiss: () => void) => void }> };
  let dialogActions: FakeDialogAction[] = [];
  const api = {
    getState: () => state,
    store: { getState: () => state, dispatch },
    onStateChange: vi.fn(),
    onAsync: vi.fn(),
    events: new EventEmitter(),
    sendNotification: vi.fn((n: typeof notification) => {
      notification = n;
    }),
    showDialog: vi.fn((_type, _title, _content, actions: FakeDialogAction[]) => {
      dialogActions = actions;
      return Promise.resolve();
    }),
  };
  const context = {
    registerReducer: vi.fn(),
    registerSettings: vi.fn(),
    once: (cb: () => void) => onceCallbacks.push(cb),
    api,
  } as unknown as IExtensionContext;
  return {
    context,
    api,
    runOnce: () => onceCallbacks.forEach((cb) => cb()),
    clickConsent: (label: string) => {
      notification.actions[0].action(() => undefined);
      dialogActions.find((entry) => entry.label === label).action();
    },
  };
}

const event = { eventName: "probe", properties: {} };
const sent = () => mp.track.mock.calls.map(([name]) => name);

describe("analytics extension consent wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tracker.current = new MixpanelAnalytics();
  });

  it("sends app_launched when the user clicks Yes in the consent dialog", () => {
    const harness = makeContext(undefined);
    init(harness.context);
    harness.runOnce();
    expect(AnalyticsMixpanel.isUserSet()).toBe(false);

    harness.clickConsent("Yes, share anonymous data");

    expect(sent()).toEqual(["app_launched"]);
  });

  it("reads consent from the store before any once callback has run", () => {
    const harness = makeContext(true);
    init(harness.context);

    AnalyticsMixpanel.start(savedUser, false);
    AnalyticsMixpanel.trackEvent(event);

    expect(sent()).toEqual(["probe"]);
  });

  it("holds consented events while a saved login restores", () => {
    const harness = makeContext(true, { restored: false });
    init(harness.context);
    harness.runOnce();
    AnalyticsMixpanel.trackEvent(event);

    AnalyticsMixpanel.start(savedUser, false);

    expect(sent()).toEqual(["probe"]);
  });

  it("drops events from a launch that starts logged out, even once someone logs in", () => {
    const harness = makeContext(true, { loggedIn: false, restored: false });
    init(harness.context);
    harness.runOnce();
    AnalyticsMixpanel.trackEvent(event);

    AnalyticsMixpanel.start({ ...savedUser, userId: 43 }, false);

    expect(mp.track).not.toHaveBeenCalled();
  });
});

describe("app_closed on unload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    tracker.current = new MixpanelAnalytics();
    relaunching.value = false;
    vi.spyOn(performance, "now").mockReturnValue(125_400.6);
  });

  // Starts analytics through the extension and returns the beforeunload handler it
  // registered. Calling it directly skips the handlers earlier tests left on window.
  function startAndGetUnloadHandler(): () => void {
    const addListener = vi.spyOn(window, "addEventListener");
    const harness = makeContext(true);
    init(harness.context);
    harness.runOnce();
    const call = addListener.mock.calls.find(([type]) => type === "beforeunload");
    return call[1] as () => void;
  }

  it("sends app_closed by beacon when the window unloads", () => {
    startAndGetUnloadHandler()();

    expect(mp.track).toHaveBeenCalledWith(
      "app_closed",
      { is_relaunch: false, session_duration_ms: 125_401 },
      { transport: "sendBeacon", send_immediately: true },
    );
  });

  it("marks the close as a relaunch when Vortex asked to restart", () => {
    relaunching.value = true;

    startAndGetUnloadHandler()();

    expect(mp.track).toHaveBeenCalledWith(
      "app_closed",
      expect.objectContaining({ is_relaunch: true }),
      expect.anything(),
    );
  });

  it("reads the restart flag and duration when the window unloads, not at startup", () => {
    vi.spyOn(performance, "now").mockReturnValue(1_000);
    const handler = startAndGetUnloadHandler();
    relaunching.value = true;
    vi.spyOn(performance, "now").mockReturnValue(125_400.6);

    handler();

    expect(mp.track).toHaveBeenCalledWith(
      "app_closed",
      { is_relaunch: true, session_duration_ms: 125_401 },
      expect.anything(),
    );
  });

  it("keeps the unload handler from throwing", () => {
    const handler = startAndGetUnloadHandler();
    vi.spyOn(tracker.current, "trackEventOnExit").mockImplementation(() => {
      throw new Error("boom");
    });

    expect(() => handler()).not.toThrow();
  });
});

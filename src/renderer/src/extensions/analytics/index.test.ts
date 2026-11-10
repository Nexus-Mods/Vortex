/**
 * Tests for the analytics extension's consent wiring: the tracker reads consent
 * from the store from init onwards, and clicking Yes in the consent dialog
 * still sends app_launched now that the tracker drops unconsented events.
 */
import { EventEmitter } from "node:events";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionContext } from "../../types/IExtensionContext";

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

import init from "./index";
import AnalyticsMixpanel from "./mixpanel/MixpanelAnalytics";

interface FakeDialogAction {
  label: string;
  action: () => void;
}

function makeContext(enabled: boolean | undefined) {
  const onceCallbacks: Array<() => void> = [];
  const state = {
    settings: {
      analytics: { enabled },
      update: { channel: "stable" },
      window: { useModernLayout: true },
    },
    persistent: { nexus: { userInfo: { userId: 42, isPremium: false, isSupporter: false } } },
  };
  // mirror the settings reducer for the one action the consent dialog dispatches
  const dispatch = vi.fn((action: { type: string; payload: unknown }) => {
    if (action.type === "SET_UPDATE_ANALYTICS") {
      state.settings.analytics.enabled = action.payload as boolean;
    }
  });
  let notification: { actions: Array<{ action: (dismiss: () => void) => void }> };
  let dialogActions: FakeDialogAction[] = [];
  const api = {
    getState: () => state,
    store: { getState: () => state, dispatch } as unknown,
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
    AnalyticsMixpanel.stop();
    vi.clearAllMocks();
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

    AnalyticsMixpanel.start({ userId: 42 } as never, false);
    AnalyticsMixpanel.trackEvent(event);

    expect(sent()).toEqual(["probe"]);
  });
});

/**
 * Tests for MixpanelAnalytics.setGameContext: it registers the active game/profile super
 * properties (game_id / profile_id) while a game is active, clears them when none is, and
 * no-ops entirely when analytics hasn't been started (user opted out).
 *
 * Also covers is_legacy_ui, which app_launched reports for the session and
 * app_ui_mode_changed reports when the user switches.
 *
 * And the consent gate: no event is queued or sent unless consent is true when
 * it fires, and the queue only covers the startup wait for login.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IValidateKeyDataV2 } from "../../nexus_integration/types/IValidateKeyData";

const mp = vi.hoisted(() => ({
  init: vi.fn(),
  identify: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  get_property: vi.fn(),
  track: vi.fn(),
  reset: vi.fn(),
}));

const serviceLog = vi.hoisted(() => vi.fn());

vi.mock("mixpanel-browser", () => ({ default: mp }));
vi.mock("../utils/analyticsLog", () => ({
  analyticsLog: vi.fn(),
  analyticsServiceLog: serviceLog,
}));
vi.mock("../../../util/application", () => ({ getApplication: () => ({ version: "1.2.3" }) }));

import analyticsMixpanel, { MixpanelAnalytics } from "./MixpanelAnalytics";
import { AppClosedEvent, AppLaunchedEvent, AppUIModeChangedEvent } from "./MixpanelEvents";

analyticsMixpanel.setConsentGetter(() => true);

const userInfo = {
  userId: 42,
  isPremium: false,
  isSupporter: false,
  isLifetime: false,
} as IValidateKeyDataV2;

describe("MixpanelAnalytics.setGameContext", () => {
  beforeEach(() => {
    analyticsMixpanel.stop();
    vi.clearAllMocks();
  });

  it("no-ops when analytics has not been started (opted out)", () => {
    analyticsMixpanel.setGameContext({
      gameId: 1704,
      profileId: "abc123",
    });
    expect(mp.register).not.toHaveBeenCalled();
    expect(mp.unregister).not.toHaveBeenCalled();
  });

  it("registers game/profile super properties when a game is active", () => {
    analyticsMixpanel.start(userInfo, false);
    mp.register.mockClear(); // start() registers the user super properties itself

    analyticsMixpanel.setGameContext({
      gameId: 1704,
      profileId: "abc123",
    });

    expect(mp.register).toHaveBeenCalledWith({
      game_id: 1704,
      profile_id: "abc123",
    });
  });

  it("leaves game_id untouched when the numeric id is unresolved", () => {
    // Registering null would overwrite the (usually correct) game_id persisted from the last session.
    analyticsMixpanel.start(userInfo, false);
    mp.register.mockClear();

    analyticsMixpanel.setGameContext({
      gameId: null,
      profileId: "abc123",
    });

    expect(mp.register).toHaveBeenCalledWith({ profile_id: "abc123" });
    expect(mp.unregister).not.toHaveBeenCalled();
  });

  it("clears game/profile super properties when no game is active", () => {
    analyticsMixpanel.start(userInfo, false);
    mp.register.mockClear();

    analyticsMixpanel.setGameContext(null);

    expect(mp.unregister).toHaveBeenCalledWith("game_id");
    expect(mp.unregister).toHaveBeenCalledWith("profile_id");
    expect(mp.register).not.toHaveBeenCalled();
  });
});

describe("AppLaunchedEvent is_legacy_ui", () => {
  beforeEach(() => {
    analyticsMixpanel.stop();
    vi.clearAllMocks();
  });

  it.each([true, false])("sends is_legacy_ui=%s through to mixpanel", (isLegacyUI) => {
    analyticsMixpanel.start(userInfo, false);

    analyticsMixpanel.trackEvent(new AppLaunchedEvent("win32", "10.0.22000", "x64", isLegacyUI));

    expect(mp.track).toHaveBeenCalledWith(
      "app_launched",
      expect.objectContaining({ is_legacy_ui: isLegacyUI }),
    );
  });

  it("leaves is_legacy_ui undefined when the caller omits it", () => {
    // The argument is optional, so an absent value must read as "unknown" downstream rather
    // than defaulting to a mode the session may not be in.
    const event = new AppLaunchedEvent("win32", "10.0.22000", "x64");

    expect(event.properties.is_legacy_ui).toBeUndefined();
  });
});

describe("AppLaunchedEvent zoom_percent", () => {
  beforeEach(() => {
    analyticsMixpanel.stop();
    vi.clearAllMocks();
  });

  it("sends the zoom level this session is running at", () => {
    analyticsMixpanel.start(userInfo, false);

    analyticsMixpanel.trackEvent(
      new AppLaunchedEvent("win32", "10.0.22000", "x64", false, undefined, 110),
    );

    expect(mp.track).toHaveBeenCalledWith(
      "app_launched",
      expect.objectContaining({ zoom_percent: 110 }),
    );
  });

  it("leaves zoom_percent undefined when the caller omits it", () => {
    const event = new AppLaunchedEvent("win32", "10.0.22000", "x64");

    expect(event.properties.zoom_percent).toBeUndefined();
  });
});

describe("AppLaunchedEvent is_hidpi", () => {
  beforeEach(() => {
    analyticsMixpanel.stop();
    vi.clearAllMocks();
  });

  it.each([true, false])("sends is_hidpi=%s through to mixpanel", (isHidpi) => {
    analyticsMixpanel.start(userInfo, false);

    analyticsMixpanel.trackEvent(
      new AppLaunchedEvent("win32", "10.0.22000", "x64", false, undefined, 100, isHidpi),
    );

    expect(mp.track).toHaveBeenCalledWith(
      "app_launched",
      expect.objectContaining({ is_hidpi: isHidpi }),
    );
  });

  it("leaves is_hidpi undefined when the caller omits it", () => {
    const event = new AppLaunchedEvent("win32", "10.0.22000", "x64");

    expect(event.properties.is_hidpi).toBeUndefined();
  });
});

describe("AppLaunchedEvent mods_table_view", () => {
  beforeEach(() => {
    analyticsMixpanel.stop();
    vi.clearAllMocks();
  });

  it.each(["beta", "classic"] as const)("sends mods_table_view=%s through to mixpanel", (view) => {
    analyticsMixpanel.start(userInfo, false);

    analyticsMixpanel.trackEvent(
      new AppLaunchedEvent("win32", "10.0.22000", "x64", false, undefined, 100, false, view),
    );

    expect(mp.track).toHaveBeenCalledWith(
      "app_launched",
      expect.objectContaining({ mods_table_view: view }),
    );
  });

  it("leaves mods_table_view undefined when the caller omits it", () => {
    const event = new AppLaunchedEvent("win32", "10.0.22000", "x64");

    expect(event.properties.mods_table_view).toBeUndefined();
  });
});

describe("AppUIModeChangedEvent", () => {
  beforeEach(() => {
    analyticsMixpanel.stop();
    vi.clearAllMocks();
  });

  it.each([true, false])("reports the mode switched to (is_legacy_ui=%s)", (isLegacyUI) => {
    analyticsMixpanel.start(userInfo, false);

    analyticsMixpanel.trackEvent(new AppUIModeChangedEvent({ is_legacy_ui: isLegacyUI }));

    expect(mp.track).toHaveBeenCalledWith("app_ui_mode_changed", { is_legacy_ui: isLegacyUI });
  });

  it("carries no other properties, so the event stays cheap to read", () => {
    const event = new AppUIModeChangedEvent({ is_legacy_ui: true });

    expect(Object.keys(event.properties)).toEqual(["is_legacy_ui"]);
  });
});

describe("AppClosedEvent", () => {
  it("carries is_relaunch and session_duration_ms and nothing else", () => {
    const event = new AppClosedEvent({ is_relaunch: true, session_duration_ms: 125_000 });

    expect(event.eventName).toBe("app_closed");
    expect(event.properties).toEqual({ is_relaunch: true, session_duration_ms: 125_000 });
  });
});

describe("MixpanelAnalytics.trackEventOnExit", () => {
  let tracker: MixpanelAnalytics;
  let consent: boolean | undefined;
  const closed = new AppClosedEvent({ is_relaunch: false, session_duration_ms: 60_000 });

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new MixpanelAnalytics();
    consent = true;
    tracker.setConsentGetter(() => consent);
  });

  it("sends by beacon, skipping the batch queue", () => {
    tracker.start(userInfo, false);
    tracker.trackEventOnExit(closed);

    expect(mp.track).toHaveBeenCalledWith(
      "app_closed",
      { is_relaunch: false, session_duration_ms: 60_000 },
      { transport: "sendBeacon", send_immediately: true },
    );
  });

  it("logs the event as tracked when the browser takes the beacon", () => {
    mp.track.mockReturnValueOnce({ event: "app_closed" });
    tracker.start(userInfo, false);
    tracker.trackEventOnExit(closed);

    expect(serviceLog).toHaveBeenCalledWith(
      "mixpanel",
      "debug",
      "Event tracked",
      expect.objectContaining({ eventName: "app_closed" }),
    );
  });

  it("warns instead of logging it as tracked when the browser refuses the beacon", () => {
    // mixpanel.track returns false when navigator.sendBeacon does.
    mp.track.mockReturnValueOnce(false);
    tracker.start(userInfo, false);
    tracker.trackEventOnExit(closed);

    expect(serviceLog).toHaveBeenCalledWith(
      "mixpanel",
      "warn",
      "Exit event not sent (beacon refused)",
      {
        eventName: "app_closed",
      },
    );
    expect(serviceLog).not.toHaveBeenCalledWith(
      "mixpanel",
      "debug",
      "Event tracked",
      expect.anything(),
    );
  });

  it("drops the exit event when analytics hasn't started", () => {
    // start() sends anything queued, so a queued exit event would show up here.
    tracker.trackEventOnExit(closed);
    tracker.start(userInfo, false);

    expect(mp.track).not.toHaveBeenCalled();
  });

  it("drops the exit event without consent", () => {
    tracker.start(userInfo, false);
    consent = false;
    tracker.trackEventOnExit(closed);

    expect(mp.track).not.toHaveBeenCalled();
  });
});

describe("MixpanelAnalytics consent and the startup queue", () => {
  let tracker: MixpanelAnalytics;
  let consent: boolean | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    // A fresh tracker per test: the queue closes for good once one has started or stopped.
    tracker = new MixpanelAnalytics();
    consent = true;
    tracker.setConsentGetter(() => consent);
  });

  const event = (name: string) => ({ eventName: name, properties: { n: name } });
  const sent = () => mp.track.mock.calls.map(([name]) => name);

  it("sends nothing from before Yes when consent was undefined", () => {
    consent = undefined;
    tracker.trackEvent(event("before_yes"));
    consent = true;
    tracker.start(userInfo, false);
    tracker.trackEvent(event("app_launched"));

    expect(sent()).toEqual(["app_launched"]);
  });

  it("sends nothing from before analytics was turned on when consent was false", () => {
    consent = false;
    tracker.trackEvent(event("while_off"));
    consent = true;
    tracker.start(userInfo, false);
    tracker.trackEvent(event("app_launched"));

    expect(sent()).toEqual(["app_launched"]);
  });

  it("sends queued updater events once login restores, in order", () => {
    tracker.trackEvent(event("update_check_started"));
    tracker.trackEvent(event("update_available"));
    expect(mp.track).not.toHaveBeenCalled();

    tracker.start(userInfo, false);

    expect(sent()).toEqual(["update_check_started", "update_available"]);
  });

  it("keeps only the most recent 50 queued events", () => {
    for (let i = 0; i < 60; i += 1) {
      tracker.trackEvent(event(`e${i}`));
    }
    tracker.start(userInfo, false);

    const names = sent();
    expect(names).toHaveLength(50);
    expect(names[0]).toBe("e10");
    expect(names.at(-1)).toBe("e59");
  });

  it("drops events between a logout and the next login", () => {
    tracker.start(userInfo, false);
    tracker.stop();
    mp.track.mockClear();
    tracker.trackEvent(event("between_accounts"));
    tracker.start({ ...userInfo, userId: 43 }, false);

    expect(mp.track).not.toHaveBeenCalled();
  });

  it("drops the queue on stop, so nothing waiting for login is sent later", () => {
    tracker.trackEvent(event("early"));
    tracker.stop();
    tracker.start(userInfo, false);

    expect(mp.track).not.toHaveBeenCalled();
  });

  it("drops events fired after start once consent is withdrawn", () => {
    tracker.start(userInfo, false);
    consent = false;
    tracker.trackEvent(event("after_off"));

    expect(mp.track).not.toHaveBeenCalled();
  });

  it("treats a throwing consent getter as no consent", () => {
    tracker.setConsentGetter(() => {
      throw new Error("store not ready");
    });
    expect(() => tracker.trackEvent(event("early"))).not.toThrow();

    tracker.setConsentGetter(() => true);
    tracker.start(userInfo, false);

    expect(mp.track).not.toHaveBeenCalled();
  });

  it("drops everything when no consent getter has been set", () => {
    const bare = new MixpanelAnalytics();
    bare.trackEvent(event("before_start"));
    bare.start(userInfo, false);
    bare.trackEvent(event("after_start"));

    expect(mp.track).not.toHaveBeenCalled();
  });
});

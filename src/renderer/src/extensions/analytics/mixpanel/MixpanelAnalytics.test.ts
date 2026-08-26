/**
 * Tests for MixpanelAnalytics.setGameContext: it registers the active game/profile super
 * properties (game_id / profile_id) while a game is active, clears them when none is, and
 * no-ops entirely when analytics hasn't been started (user opted out).
 *
 * Also covers is_legacy_ui, which app_launched reports for the session and
 * app_ui_mode_changed reports when the user switches.
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

vi.mock("mixpanel-browser", () => ({ default: mp }));
vi.mock("../../../util/application", () => ({ getApplication: () => ({ version: "1.2.3" }) }));

import analyticsMixpanel from "./MixpanelAnalytics";
import { AppLaunchedEvent, AppUIModeChangedEvent } from "./MixpanelEvents";

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

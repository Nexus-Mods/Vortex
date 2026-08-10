/**
 * Tests for MixpanelAnalytics.setGameContext: it registers the active game/profile super
 * properties (game_id / profile_id) while a game is active, clears them when none is, and
 * no-ops entirely when analytics hasn't been started (user opted out).
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

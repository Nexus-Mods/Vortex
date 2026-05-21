import { describe, it, expect } from "vitest";

import type { IProfile } from "../types/IProfile";
import { profilesReducer } from "./profiles";

type ProfilesState = { [profileId: string]: IProfile };

const reduce = profilesReducer.reducers as {
  SET_MOD_ENABLED: (
    state: ProfilesState,
    payload: { profileId: string; modId: string; enable: boolean },
  ) => ProfilesState;
  SET_PROFILE_FEATURE: (
    state: ProfilesState,
    payload: { profileId: string; featureId: string; value: string },
  ) => ProfilesState;
};

describe("setModEnabled", () => {
  it("sets the mod enabled", () => {
    const input: ProfilesState = {
      profileId1: {
        id: "profileId1",
        gameId: "game",
        name: "Profile 1",
        modState: { modId1: { enabled: false, enabledTime: 0 } },
        lastActivated: 0,
      },
    };
    const result = reduce.SET_MOD_ENABLED(input, {
      profileId: "profileId1",
      modId: "modId1",
      enable: true,
    });
    expect(result.profileId1.modState.modId1.enabled).toBe(true);
  });

  it("does nothing if the profile doesn't exist", () => {
    const input: ProfilesState = {
      profileId1: {
        id: "profileId1",
        gameId: "game",
        name: "Profile 1",
        modState: { modId1: { enabled: false, enabledTime: 0 } },
        lastActivated: 0,
      },
    };
    const result = reduce.SET_MOD_ENABLED(input, {
      profileId: "profileId2",
      modId: "modId1",
      enable: true,
    });
    expect(result.profileId1.modState.modId1.enabled).toBe(false);
  });

  it("affects only the right profile", () => {
    const input: ProfilesState = {
      profileId1: {
        id: "profileId1",
        gameId: "game",
        name: "Profile 1",
        modState: { modId1: { enabled: false, enabledTime: 0 } },
        lastActivated: 0,
      },
      profileId2: {
        id: "profileId2",
        gameId: "game",
        name: "Profile 2",
        modState: { modId1: { enabled: false, enabledTime: 0 } },
        lastActivated: 0,
      },
    };
    const result = reduce.SET_MOD_ENABLED(input, {
      profileId: "profileId1",
      modId: "modId1",
      enable: true,
    });
    expect(result.profileId1.modState.modId1.enabled).toBe(true);
    expect(result.profileId2.modState.modId1.enabled).toBe(false);
  });
});

describe("setFeature", () => {
  it("sets the value for the profile feature", () => {
    const input: ProfilesState = {
      profileId1: {
        id: "profileId1",
        gameId: "game",
        name: "Profile 1",
        modState: {},
        lastActivated: 0,
        features: { featureId1: "value" },
      },
    };
    const result = reduce.SET_PROFILE_FEATURE(input, {
      profileId: "profileId1",
      featureId: "featureId1",
      value: "new Value",
    });
    expect(result.profileId1.features?.featureId1).toBe("new Value");
  });

  it("does nothing if the profile doesn't exist", () => {
    const input: ProfilesState = {
      profileId1: {
        id: "profileId1",
        gameId: "game",
        name: "Profile 1",
        modState: {},
        lastActivated: 0,
        features: { featureId1: "value" },
      },
    };
    const result = reduce.SET_PROFILE_FEATURE(input, {
      profileId: "profileId2",
      featureId: "featureId1",
      value: "new Value",
    });
    expect(result.profileId1.features?.featureId1).toBe("value");
  });

  it("affects only the right profile", () => {
    const input: ProfilesState = {
      profileId1: {
        id: "profileId1",
        gameId: "game",
        name: "Profile 1",
        modState: {},
        lastActivated: 0,
        features: { featureId1: "value" },
      },
      profileId2: {
        id: "profileId2",
        gameId: "game",
        name: "Profile 2",
        modState: {},
        lastActivated: 0,
        features: { featureId1: "value" },
      },
    };
    const result = reduce.SET_PROFILE_FEATURE(input, {
      profileId: "profileId1",
      featureId: "featureId1",
      value: "new Value",
    });
    expect(result.profileId1.features?.featureId1).toBe("new Value");
    expect(result.profileId2.features?.featureId1).toBe("value");
  });
});

import { describe, it, expect } from "vitest";

import { setUserAPIKey } from "../actions/account";
import { accountReducer, type INexusAccountState } from "./account";

describe("setUserAPIKey", () => {
  it("sets the key", () => {
    const input: INexusAccountState = { ForcedLogout: false };
    const result = accountReducer.reducers.SET_USER_API_KEY(input, setUserAPIKey("key").payload);
    expect(result.APIKey).toBe("key");
  });
});

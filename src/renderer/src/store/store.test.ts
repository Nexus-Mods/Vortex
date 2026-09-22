import type * as Redux from "redux";
import { describe, expect, it } from "vitest";

import type { IState } from "../types/IState";
import { DataInvalid } from "../util/CustomErrors";
import { BACKUP_HIVES, serializeState } from "./store";

const makeStore = (state: unknown): Redux.Store<IState> =>
  ({ getState: () => state }) as unknown as Redux.Store<IState>;

const fullState = {
  app: { appVersion: "1.0.0" },
  user: { multiUser: false },
  settings: { interface: { language: "en" } },
  persistent: { mods: {} },
  session: { base: { activity: {} }, nexus: { loginId: "abc" } },
  confidential: { account: { nexus: { APIKey: "secret" } } },
};

describe("serializeState", () => {
  it("keeps only the backup hives by default", () => {
    const result = JSON.parse(serializeState(makeStore(fullState), BACKUP_HIVES));

    expect(Object.keys(result).sort()).toEqual(["app", "persistent", "settings", "user"]);
    expect(result).not.toHaveProperty("confidential");
    expect(result).not.toHaveProperty("session");
  });

  it("includes session when asked for it", () => {
    const result = JSON.parse(serializeState(makeStore(fullState), [...BACKUP_HIVES, "session"]));

    expect(result.session).toEqual(fullState.session);
    expect(result).not.toHaveProperty("confidential");
  });

  it("throws DataInvalid when the state can't be stringified", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => serializeState(makeStore({ settings: circular }), BACKUP_HIVES)).toThrow(
      DataInvalid,
    );
  });
});

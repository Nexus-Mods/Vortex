import { describe, expect, it } from "vitest";

import { setDevSetting } from "../actions/devTools";
import { devToolsReducer } from "./devTools";

describe("devToolsReducer", () => {
  it("starts with every switch off", () => {
    expect(devToolsReducer.defaults).toEqual({ newTable: false });
  });

  it("sets a switch", () => {
    const { payload } = setDevSetting("newTable", true);

    expect(devToolsReducer.reducers[setDevSetting.getType()]({ newTable: false }, payload)).toEqual(
      {
        newTable: true,
      },
    );
  });
});

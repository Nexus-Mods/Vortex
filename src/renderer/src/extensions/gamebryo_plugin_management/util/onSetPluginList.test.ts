import { describe, expect } from "vitest";

import { test } from "../../../test-utils/gamebryoTest";
import { setPluginEnabled, setPluginOrder } from "../actions/loadOrder";
import { handleSetPluginList } from "./onSetPluginList";

describe("handleSetPluginList", () => {
  test("keeps the plugin names and enabled states when told not to enable", ({ makeGamebryo }) => {
    const harness = makeGamebryo();
    harness.api.store.dispatch(setPluginOrder(["A.esp", "MixedCase.esp"], false));
    harness.api.store.dispatch(setPluginEnabled("A.esp", true));

    handleSetPluginList(harness.api, ["MixedCase.esp", "A.esp"], false);

    expect(harness.getGamebryoState().loadOrder).toEqual({
      "mixedcase.esp": { name: "MixedCase.esp", enabled: false, loadOrder: 0 },
      "a.esp": { name: "A.esp", enabled: true, loadOrder: 1 },
    });
  });

  test("enables every listed plugin and disables the rest when no flag is given", ({
    makeGamebryo,
  }) => {
    const harness = makeGamebryo();
    harness.api.store.dispatch(setPluginOrder(["A.esp", "B.esp", "C.esp"], false));

    handleSetPluginList(harness.api, ["C.esp", "A.esp"], undefined);

    const loadOrder = harness.getGamebryoState().loadOrder;
    expect(loadOrder["c.esp"]).toMatchObject({ enabled: true, loadOrder: 0 });
    expect(loadOrder["a.esp"]).toMatchObject({ enabled: true, loadOrder: 1 });
    expect(loadOrder["b.esp"]).toMatchObject({ enabled: false, loadOrder: 2 });
  });
});

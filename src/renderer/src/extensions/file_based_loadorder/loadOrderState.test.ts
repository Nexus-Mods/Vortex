import { describe, expect } from "vitest";

import { makeLoadOrder } from "../../test-utils/builders";
import { test } from "../../test-utils/fbloTest";
import { removeProfile } from "../profile_management/actions/profiles";
import { setFBLoadOrder, setFBLoadOrderEntry } from "./actions/loadOrder";
import { dropRemovedProfileLoadOrders } from "./profileCleanup";
import { loadOrderForProfile } from "./selectors";
import { DEFAULT_LOAD_ORDER_ID } from "./types/types";

describe("primary load order", () => {
  test.for([undefined, DEFAULT_LOAD_ORDER_ID])(
    "is the order set with id %j, and leaves the named orders empty",
    (loadOrderId, { makeFblo }) => {
      const fblo = makeFblo();
      const loadOrder = makeLoadOrder("a.pak", "b.pak");

      fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, loadOrder, loadOrderId));

      expect(fblo.loadOrder()).toEqual(loadOrder);
      expect(fblo.loadOrder(DEFAULT_LOAD_ORDER_ID)).toEqual(loadOrder);
      expect(fblo.loadOrder("archive")).toEqual([]);
    },
  );

  test("keeps its order when a named order is set", ({ makeFblo }) => {
    const fblo = makeFblo();
    const primary = makeLoadOrder("a.pak");
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, primary));

    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, makeLoadOrder("b.pak"), "archive"));

    expect(fblo.loadOrder()).toEqual(primary);
  });

  test("keeps its order when the payload is null", ({ makeFblo }) => {
    const fblo = makeFblo();
    const primary = makeLoadOrder("a.pak");
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, primary));

    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, null));

    expect(fblo.loadOrder()).toEqual(primary);
  });

  test("collects the entries of an object payload", ({ makeFblo }) => {
    const fblo = makeFblo();
    const [first, second] = makeLoadOrder("a.pak", "b.pak");

    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, { 0: first, 1: second }));

    expect(fblo.loadOrder()).toEqual([first, second]);
  });

  test("replaces one entry by id", ({ makeFblo }) => {
    const fblo = makeFblo();
    const [first, second] = makeLoadOrder("a.pak", "b.pak");
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, [first, second]));
    const changed = { ...second, enabled: false };

    fblo.api.store.dispatch(setFBLoadOrderEntry(fblo.profileId, changed));

    expect(fblo.loadOrder()).toEqual([first, changed]);
  });

  test("keeps its entries when a named order's entry changes", ({ makeFblo }) => {
    const fblo = makeFblo();
    const primary = makeLoadOrder("a.pak");
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, primary));

    fblo.api.store.dispatch(
      setFBLoadOrderEntry(fblo.profileId, { ...primary[0], enabled: false }, "archive"),
    );

    expect(fblo.loadOrder()).toEqual(primary);
  });
});

describe("named load orders", () => {
  test("are stored per id, apart from the primary", ({ makeFblo }) => {
    const fblo = makeFblo();
    const archive = makeLoadOrder("a.pak");
    const redmod = makeLoadOrder("r.pak");

    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, archive, "archive"));
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, redmod, "redmod"));

    expect(fblo.loadOrder("archive")).toEqual(archive);
    expect(fblo.loadOrder("redmod")).toEqual(redmod);
    expect(fblo.loadOrder()).toEqual([]);
  });

  test.for([null, {}, "a.pak"])(
    "keep their order on the non-array payload %j",
    (payload, { makeFblo }) => {
      const fblo = makeFblo();
      const archive = makeLoadOrder("a.pak");
      fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, archive, "archive"));

      fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, payload, "archive"));

      expect(fblo.loadOrder("archive")).toEqual(archive);
    },
  );

  test("replace one entry by id", ({ makeFblo }) => {
    const fblo = makeFblo();
    const [first, second] = makeLoadOrder("a.pak", "b.pak");
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, [first, second], "archive"));
    const changed = { ...second, enabled: false };

    fblo.api.store.dispatch(setFBLoadOrderEntry(fblo.profileId, changed, "archive"));

    expect(fblo.loadOrder("archive")).toEqual([first, changed]);
  });

  test("keep their entries when the primary's entry changes", ({ makeFblo }) => {
    const fblo = makeFblo();
    const archive = makeLoadOrder("a.pak");
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, archive, "archive"));

    fblo.api.store.dispatch(setFBLoadOrderEntry(fblo.profileId, { ...archive[0], enabled: false }));

    expect(fblo.loadOrder("archive")).toEqual(archive);
  });
});

describe("profile removal", () => {
  test("drops the removed profile's load orders and keeps other profiles'", ({ makeFblo }) => {
    const fblo = makeFblo();
    const other = makeLoadOrder("other.pak");
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, makeLoadOrder("a.pak")));
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, makeLoadOrder("b.pak"), "archive"));
    fblo.api.store.dispatch(setFBLoadOrder("profile-2", other));
    fblo.api.store.dispatch(setFBLoadOrder("profile-2", other, "archive"));
    const profilesBefore = fblo.getState().persistent.profiles;

    fblo.api.store.dispatch(removeProfile(fblo.profileId));
    dropRemovedProfileLoadOrders(fblo.api, profilesBefore, fblo.getState().persistent.profiles);

    expect(fblo.loadOrder()).toEqual([]);
    expect(fblo.loadOrder("archive")).toEqual([]);
    expect(loadOrderForProfile(fblo.getState(), "profile-2")).toEqual(other);
    expect(loadOrderForProfile(fblo.getState(), "profile-2", "archive")).toEqual(other);
  });

  test("keeps every load order when no profile was removed", ({ makeFblo }) => {
    const fblo = makeFblo();
    const primary = makeLoadOrder("a.pak");
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, primary));
    const profiles = fblo.getState().persistent.profiles;

    dropRemovedProfileLoadOrders(fblo.api, profiles, profiles);

    expect(fblo.loadOrder()).toEqual(primary);
  });
});

describe("loadOrderForProfile", () => {
  test("returns the same empty order for every miss", ({ makeFblo }) => {
    const fblo = makeFblo();

    const miss = fblo.loadOrder();

    expect(miss).toEqual([]);
    expect(fblo.loadOrder("archive")).toBe(miss);
    expect(loadOrderForProfile(fblo.getState(), "profile-2")).toBe(miss);
  });
});

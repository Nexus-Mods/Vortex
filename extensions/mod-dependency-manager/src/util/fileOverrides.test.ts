import { describe, expect } from "vitest";

import {
  DINPUT_MOD,
  ENB_MOD,
  loadOrderRule,
  SHARED_FILE,
  test,
} from "../test-utils/sharedFileTest";
import notifyModTypeConflict from "./modTypeConflictNotification";

describe("planOverrideUpdate", () => {
  test("lets one of two mod types sharing a file deploy it", ({ makeSharedFile }) => {
    const shared = makeSharedFile({ dinputOverrides: [SHARED_FILE], enbOverrides: [SHARED_FILE] });

    expect(shared.plan()).toEqual({
      overrides: { [DINPUT_MOD]: [SHARED_FILE], [ENB_MOD]: [] },
      purgeFirst: true,
    });
  });

  test("keeps the mod that deploys a shared file while no rule decides", ({ makeSharedFile }) => {
    const shared = makeSharedFile({ enbOverrides: [SHARED_FILE] });

    expect(shared.plan()).toEqual({
      overrides: { [DINPUT_MOD]: [], [ENB_MOD]: [SHARED_FILE] },
      purgeFirst: false,
    });
  });

  test("keeps the mod that deploys a shared file when the load order puts another last", ({
    makeSharedFile,
  }) => {
    const shared = makeSharedFile({
      enbOverrides: [SHARED_FILE],
      dinputRules: [loadOrderRule("before", ENB_MOD)],
    });

    expect(shared.plan()).toEqual({
      overrides: { [DINPUT_MOD]: [], [ENB_MOD]: [SHARED_FILE] },
      purgeFirst: false,
    });
  });

  test("lets a load after rule pick the mod that deploys a shared file", ({ makeSharedFile }) => {
    const shared = makeSharedFile({
      dinputOverrides: [SHARED_FILE],
      enbOverrides: [SHARED_FILE],
      dinputRules: [loadOrderRule("after", ENB_MOD)],
    });

    expect(shared.plan()).toEqual({
      overrides: { [DINPUT_MOD]: [], [ENB_MOD]: [SHARED_FILE] },
      purgeFirst: true,
    });
  });

  test("lets a load before rule pick the mod that deploys a shared file", ({ makeSharedFile }) => {
    const shared = makeSharedFile({
      dinputOverrides: [SHARED_FILE],
      enbOverrides: [SHARED_FILE],
      enbRules: [loadOrderRule("before", DINPUT_MOD)],
    });

    expect(shared.plan()).toEqual({
      overrides: { [DINPUT_MOD]: [], [ENB_MOD]: [SHARED_FILE] },
      purgeFirst: true,
    });
  });

  test("purges first when an edit moves a shared file to another mod type", ({
    makeSharedFile,
  }) => {
    const shared = makeSharedFile({ dinputOverrides: [SHARED_FILE] });

    expect(shared.plan({ [DINPUT_MOD]: [], [ENB_MOD]: [SHARED_FILE] })).toEqual({
      overrides: { [DINPUT_MOD]: [], [ENB_MOD]: [SHARED_FILE] },
      purgeFirst: true,
    });
  });

  test("moves a shared file between mods of one type without a purge", ({ makeSharedFile }) => {
    const shared = makeSharedFile({
      enbModType: "dinput",
      dinputOverrides: [SHARED_FILE],
      enbOverrides: [SHARED_FILE],
      dinputRules: [loadOrderRule("after", ENB_MOD)],
    });

    expect(shared.plan()).toEqual({
      overrides: { [DINPUT_MOD]: [], [ENB_MOD]: [SHARED_FILE] },
      purgeFirst: false,
    });
  });
});

describe("notifyModTypeConflict", () => {
  test("recommends the Dependencies column for a mod type conflict", ({ makeSharedFile }) => {
    const shared = makeSharedFile({ dinputOverrides: [SHARED_FILE] });

    notifyModTypeConflict(shared.api);

    expect(shared.notifications.map((notification) => notification.id)).toEqual([
      "mod-type-conflict-dependencies-column",
    ]);
  });

  test("stays quiet while the Dependencies column is shown", ({ makeSharedFile }) => {
    const shared = makeSharedFile({
      dinputOverrides: [SHARED_FILE],
      dependenciesColumnVisible: true,
    });

    notifyModTypeConflict(shared.api);

    expect(shared.notifications).toEqual([]);
  });

  test("stays quiet for file overrides between mods of one type", ({ makeSharedFile }) => {
    const shared = makeSharedFile({ enbModType: "dinput", dinputOverrides: [SHARED_FILE] });

    notifyModTypeConflict(shared.api);

    expect(shared.notifications).toEqual([]);
  });
});

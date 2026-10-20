import type { types } from "@nexusmods/vortex-api";
import { VortexModId } from "@vortex/shared";

import { setAttributeVisible } from "../../../../src/renderer/src/actions/tables";
import { tableReducer } from "../../../../src/renderer/src/reducers/tables";
import {
  makeGameHarness,
  makeLookup,
  makeMod,
  makeProfileMod,
  makeRule,
} from "../../../../src/renderer/src/test-utils/builders";
import { test as harnessTest } from "../../../../src/renderer/src/test-utils/harnessTest";
import type { IGameHarness } from "../../../../src/renderer/src/test-utils/harnessTypes";
import { setConflictInfo } from "../actions";
import { sessionReducer } from "../reducers";
import { enabledModIds } from "../selectors";
import type { IConflict } from "../types/IConflict";
import { type FileOverridesByMod, planOverrideUpdate } from "../util/fileOverrides";

export const DINPUT_MOD = VortexModId("dinput-mod");
export const ENB_MOD = VortexModId("enb-mod");
export const SHARED_FILE = "D:\\Games\\fnv\\d3d9.dll";

export interface ISharedFileOptions {
  enbModType?: string;
  dinputOverrides?: string[];
  enbOverrides?: string[];
  dinputRules?: types.IModRule[];
  enbRules?: types.IModRule[];
  dependenciesColumnVisible?: boolean;
}

export interface ISharedFileHarness extends IGameHarness {
  // each mod's overrides after an override update
  plan: (edits?: FileOverridesByMod) => { overrides: FileOverridesByMod; purgeFirst: boolean };
}

export interface ISharedFileFixtures {
  // two enabled mods of the active game, both deploying SHARED_FILE
  makeSharedFile: (options?: ISharedFileOptions) => ISharedFileHarness;
}

export const loadOrderRule = (type: "before" | "after", otherModId: VortexModId) =>
  makeRule({ type, reference: { id: otherModId } });

const conflictWith = (otherModId: VortexModId): IConflict => ({
  otherMod: { ...makeLookup(), id: otherModId },
  files: [SHARED_FILE],
  suggestion: null,
});

function makeSharedFile(options: ISharedFileOptions = {}): ISharedFileHarness {
  const harness = makeGameHarness(
    {
      mods: {
        [DINPUT_MOD]: makeMod({
          id: DINPUT_MOD,
          type: "dinput",
          attributes: { name: DINPUT_MOD },
          fileOverrides: options.dinputOverrides ?? [],
          rules: options.dinputRules ?? [],
        }),
        [ENB_MOD]: makeMod({
          id: ENB_MOD,
          type: options.enbModType ?? "enb",
          attributes: { name: ENB_MOD },
          fileOverrides: options.enbOverrides ?? [],
          rules: options.enbRules ?? [],
        }),
      },
    },
    [
      { path: ["session", "dependencies"], reducer: sessionReducer },
      { path: ["settings", "tables"], reducer: tableReducer },
    ],
  );
  const conflicts: Record<VortexModId, IConflict[]> = {
    [DINPUT_MOD]: [conflictWith(ENB_MOD)],
    [ENB_MOD]: [conflictWith(DINPUT_MOD)],
  };
  harness.setState((draft) => {
    draft.persistent.profiles[harness.profileId].modState = {
      [DINPUT_MOD]: makeProfileMod(),
      [ENB_MOD]: makeProfileMod(),
    };
  });
  harness.api.store.dispatch(setConflictInfo(conflicts));
  if (options.dependenciesColumnVisible === true) {
    harness.api.store.dispatch(setAttributeVisible("mods", "dependencies", true));
  }

  return {
    ...harness,
    plan: (edits = {}) => {
      const state = harness.getState();
      const mods = state.persistent.mods[harness.gameId];
      const { changes, purgeFirst } = planOverrideUpdate(
        mods,
        enabledModIds(state),
        conflicts,
        edits,
      );
      const current: FileOverridesByMod = {
        [DINPUT_MOD]: mods[DINPUT_MOD].fileOverrides ?? [],
        [ENB_MOD]: mods[ENB_MOD].fileOverrides ?? [],
      };
      return { overrides: { ...current, ...changes }, purgeFirst };
    },
  };
}

/** File override suites: harnessTest plus two enabled mods sharing a file. */
export const test = harnessTest.extend<ISharedFileFixtures>({
  // `task` is destructured + ignored only to satisfy vitest's object-pattern requirement
  makeSharedFile: async ({ task: _task }, use) => {
    // `use` is the vitest fixture callback, not React's use() hook.
    // eslint-disable-next-line @eslint-react/rules-of-hooks
    await use(makeSharedFile);
  },
});

import { fs, log, selectors, types } from "@nexusmods/vortex-api";
import type * as Redux from "redux";
import { batch } from "redux-act";
import { test as base, vi, type Mock } from "vitest";

const BATCH_TYPE: string = (batch as unknown as { getType: () => string }).getType();

/**
 * At runtime the `@nexusmods/vortex-api` imports above resolve to the vitest stand-in
 * (test-utils/vortex-api.ts via the alias in vitest.config.ts) whose fs/selectors/log
 * members are vi.fn() doubles; at check time they carry the real package's types. This
 * is the single place that bridges the two views, so the casts live here only.
 */
const asMock = (fn: unknown): Mock => fn as Mock;

/** The mutable doubles of the vortex-api stand-in, reset around every test. */
export interface IVortexApiDoubles {
  readdirAsync: Mock;
  activeGameId: Mock;
  activeProfile: Mock;
  getCollectionActiveSession: Mock;
  installPath: Mock;
}

/**
 * Fixture handing tests the vortex-api doubles in a clean state. Arrange by setting
 * return values on the doubles; the aliased module serves the same instances to the
 * code under test.
 */
export const vortexApiTest = base.extend<{ vortexApi: IVortexApiDoubles }>({
  // eslint-disable-next-line no-empty-pattern
  vortexApi: async ({}, use) => {
    const doubles: IVortexApiDoubles = {
      readdirAsync: asMock(fs.readdirAsync),
      activeGameId: asMock(selectors.activeGameId),
      activeProfile: asMock(selectors.activeProfile),
      getCollectionActiveSession: asMock(
        (selectors as { getCollectionActiveSession?: unknown }).getCollectionActiveSession,
      ),
      installPath: asMock(selectors.installPath),
    };
    const reset = () => {
      Object.values(doubles).forEach((double) => double.mockReset());
      asMock(log).mockReset();
    };
    reset();
    await use(doubles);
    reset();
  },
});

/** Mirrors the renderer test-utils makeMod builder (unreachable across the package boundary). */
export function makeMod(overrides: Partial<types.IMod> = {}): types.IMod {
  return {
    id: "mod-1",
    state: "installed",
    type: "",
    installationPath: "mods/mod-1",
    attributes: {},
    ...overrides,
  };
}

/** A minimal IExtensionApi double: a spied store over fixed state plus notification spies. */
export interface IExtensionApiDouble {
  store: { getState: () => unknown; dispatch: Mock };
  sendNotification: Mock;
  showErrorNotification: Mock;
  translate: (input: string) => string;
  events: { emit: Mock };
}

export function makeExtensionApi(state: unknown): IExtensionApiDouble {
  return {
    store: {
      getState: () => state,
      dispatch: vi.fn(),
    },
    sendNotification: vi.fn(),
    showErrorNotification: vi.fn(),
    translate: (input: string) => input,
    events: { emit: vi.fn() },
  };
}

/**
 * Flatten a dispatch spy's calls into plain actions, unwrapping redux-act batch actions
 * (the shape util.batchDispatch produces) so assertions see individual actions.
 */
export function dispatchedActions(dispatch: Mock): Redux.Action[] {
  return dispatch.mock.calls.flatMap(([action]) =>
    action?.type === BATCH_TYPE ? action.payload : [action],
  );
}

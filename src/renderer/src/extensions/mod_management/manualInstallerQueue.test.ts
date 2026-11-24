import { VortexGameId } from "@vortex/shared";
import { combineReducers, createStore } from "redux";
import { createReducer } from "redux-act";
import { describe, expect, it } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import {
  answerManualInstallerRequest,
  requestManualInstallerDestination,
  type IManualInstallerAnswer,
} from "./manualInstallerQueue";
import { manualInstallerReducer } from "./reducers/manualInstaller";

const makeApi = () => {
  const store = createStore(
    combineReducers({
      session: combineReducers({
        manualInstaller: createReducer(
          manualInstallerReducer.reducers,
          manualInstallerReducer.defaults,
        ),
        base: (state: object = {}) => state,
      }),
    }),
  );
  const api = { store, getState: () => store.getState() } as unknown as IExtensionApi;
  const pendingIds = () => store.getState().session.manualInstaller.pending.map(({ id }) => id);
  return { api, pendingIds };
};

const request = (batchId?: string) => ({
  gameId: VortexGameId("game"),
  modName: "mod",
  remaining: 0,
  gameFolder: "",
  files: [],
  ownStagingFolders: [],
  batchId,
});

const answer = (overrides: Partial<IManualInstallerAnswer> = {}): IManualInstallerAnswer => ({
  folder: "Foo",
  skipTopFolder: false,
  useAsDefault: false,
  dontAskAgain: false,
  useForAll: false,
  ...overrides,
});

describe("answerManualInstallerRequest", () => {
  it("answers one request at a time and keeps the others waiting", async () => {
    const { api, pendingIds } = makeApi();
    const first = requestManualInstallerDestination(api, request("batch"));
    const second = requestManualInstallerDestination(api, request("batch"));
    const [firstId, secondId] = pendingIds();

    answerManualInstallerRequest(api, firstId, answer());

    await expect(first).resolves.toEqual(answer());
    expect(pendingIds()).toEqual([secondId]);

    answerManualInstallerRequest(api, secondId, undefined);
    await expect(second).resolves.toBeUndefined();
    expect(pendingIds()).toEqual([]);
  });

  it("answers the waiting requests of the batch too when it is used for all", async () => {
    const { api, pendingIds } = makeApi();
    const first = requestManualInstallerDestination(api, request("batch"));
    const second = requestManualInstallerDestination(api, request("batch"));
    const third = requestManualInstallerDestination(api, request("batch"));

    answerManualInstallerRequest(api, pendingIds()[0], answer({ useForAll: true }));

    await expect(first).resolves.toEqual(answer({ useForAll: true }));
    await expect(second).resolves.toEqual(answer({ useForAll: true, fromBatch: true }));
    await expect(third).resolves.toEqual(answer({ useForAll: true, fromBatch: true }));
    expect(pendingIds()).toEqual([]);
  });

  it("leaves requests of other batches, or of none, waiting", async () => {
    const { api, pendingIds } = makeApi();
    void requestManualInstallerDestination(api, request("batch"));
    void requestManualInstallerDestination(api, request("other"));
    void requestManualInstallerDestination(api, request(undefined));
    const [firstId, otherId, noneId] = pendingIds();

    answerManualInstallerRequest(api, firstId, answer({ useForAll: true }));

    expect(pendingIds()).toEqual([otherId, noneId]);
  });

  it("doesn't answer the waiting requests when the first one is cancelled", () => {
    const { api, pendingIds } = makeApi();
    void requestManualInstallerDestination(api, request("batch"));
    void requestManualInstallerDestination(api, request("batch"));
    const [firstId, secondId] = pendingIds();

    answerManualInstallerRequest(api, firstId, undefined);

    expect(pendingIds()).toEqual([secondId]);
  });
});

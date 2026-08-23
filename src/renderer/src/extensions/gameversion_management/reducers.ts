import type { IReducerSpec } from "../../types/IExtensionContext";
import { deleteOrNop, setSafe } from "../../util/storeHelper";
import { setGameVersionJob } from "./actions";
import type { IGameVersionSessionState } from "./types/IGameVersionState";

export const sessionReducer: IReducerSpec<IGameVersionSessionState> = {
  reducers: {
    [setGameVersionJob as any]: (state, payload) =>
      payload.job === undefined
        ? deleteOrNop(state, ["jobs", payload.gameId])
        : setSafe(state, ["jobs", payload.gameId], payload.job),
  },
  defaults: { jobs: {} },
};

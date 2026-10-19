import { createAction } from "redux-act";

export const setPhaseCount = createAction("SET_DISCOVERY_PHASE_COUNT", (count: number) => count);

export const discoveryProgress = createAction(
  "DISCOVERY_PROGRESS",
  (idx: number, percent: number, directory: string) => ({
    idx,
    percent,
    directory,
  }),
);

export const discoveryFinished = createAction("DISCOVERY_FINISHED");

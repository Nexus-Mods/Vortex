import type { IState } from "../../types/IState";
// importing the slice types also brings their `declare module` augmentations into every program
// that uses these guards, including the vortex-api type build, which never sees the reducers
import type { INexusAccountState } from "./reducers/account";
import type { INexusPersistentState } from "./reducers/persistent";

type IStatePersistent = IState["persistent"];
type IStateConfidential = IState["confidential"];

export type IStatePersistentWithNexus = IStatePersistent & { nexus: INexusPersistentState };

export type IStateConfidentialWithNexus = IStateConfidential & {
  account: { nexus: INexusAccountState };
};

/**
 * whether the nexus slice is present. The type declares it, but it only exists once the
 * nexus_integration extension has registered its reducer, so callers that can run before that
 * (or without it) still check.
 */
export const hasPersistentWithNexus = (
  statePersistent: IStatePersistent,
): statePersistent is IStatePersistentWithNexus =>
  "nexus" in statePersistent &&
  typeof statePersistent.nexus === "object" &&
  statePersistent.nexus !== null;

/** whether the nexus account slice is present; see hasPersistentWithNexus */
export const hasConfidentialWithNexus = (
  stateConfidential: IStateConfidential,
): stateConfidential is IStateConfidentialWithNexus =>
  "nexus" in stateConfidential.account &&
  typeof stateConfidential.account.nexus === "object" &&
  stateConfidential.account.nexus !== null;

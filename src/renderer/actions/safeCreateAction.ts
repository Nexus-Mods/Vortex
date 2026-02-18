import { createAction, types } from "redux-act";

// NOTE(erri120): Welcome, this file exists because someone didn't know that you can disable throwing errors on duplicate action types:
types.disableChecking();

// NOTE(erri120): If you'd like to see the abomination that was the previous version of this file:
// https://github.com/Nexus-Mods/Vortex/blob/810d40123f354251443491fd81628b78dffc4c13/src/actions/safeCreateAction.ts

/** @deprecated Use createAction from redux-act directly */
export default createAction;

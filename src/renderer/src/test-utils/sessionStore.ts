/**
 * Minimal redux store wired to the real install-tracking reducer, for the
 * session state-machine tests: a test dispatches the exact typed actions that
 * InstallManager / InstallDriver dispatch and reads the result back through the
 * production selectors. No Electron, persistence, or extension registration.
 *
 * Test-only: nothing in the production tree imports this module.
 */
import { createStore, type Store } from "redux";
import { createReducer } from "redux-act";

import trackingReducer from "../reducers/collectionInstallTracking";
import type { ICollectionInstallState } from "../types/collections/ICollectionInstallSession";
import type { IState } from "../types/IState";

export function createSessionStore(): Store<ICollectionInstallState> {
  return createStore(createReducer(trackingReducer.reducers, trackingReducer.defaults));
}

/**
 * Wrap the install-tracking slice as the minimal IState the collection-session
 * selectors read - they only touch `state.session.collections`. A full IState is
 * impractical to construct in a unit test, so the one unavoidable cast lives here
 * rather than being scattered across every selector assertion.
 */
export function asIState(slice: ICollectionInstallState): IState {
  return { session: { collections: slice } } as unknown as IState;
}

import type { ComplexActionCreator } from "redux-act";

import type { IReducerSpec, IStateVerifier } from "@/types/IExtensionContext";

export type ActionsToReducerMapping<TActions, TState> = {
  [K in keyof TActions]: TActions[K] extends ComplexActionCreator<infer TPayload>
    ? (state: TState, payload: TPayload) => TState
    : never;
};

export type StateToVerifiers<TState> = {
  [K in keyof TState]: IStateVerifier;
};

/**
 * Builds IReducerSpec from known actions.
 * @public
 */
export function actionsToReducerSpec<TState, TActions>(
  defaultState: TState,
  actions: TActions,
  mapping: ActionsToReducerMapping<TActions, TState>,
  verifiers?: Partial<StateToVerifiers<TState>>,
): IReducerSpec<TState> {
  const reducers: Record<string, (state: TState, payload: unknown) => TState> = {};

  Object.entries<(state: TState, payload: unknown) => TState>(mapping).map((entry) => {
    const [actionKey, reducer] = entry;

    // NOTE(erri120): safe cast due to assertions before
    const action = actions[actionKey as keyof TActions] as ComplexActionCreator<unknown>;

    reducers[action.getType()] = reducer;
  });

  return {
    defaults: defaultState,
    reducers: reducers,
    verifiers,
  };
}

import type { ComplexActionCreator } from "redux-act";

import type { IExtensionReducer } from "@/types/extensions";
import type {
  IExtensionContext,
  IPartialReducerSpec,
  IReducerSpec,
  IStateVerifier,
  ReducerSpecFor,
  StatePath,
} from "@/types/IExtensionContext";

export type ActionsToReducerMapping<TActions, TState> = {
  [K in keyof TActions]: TActions[K] extends ComplexActionCreator<infer TPayload>
    ? (state: TState, payload: TPayload) => TState
    : never;
};

export type StateToVerifiers<TState> = {
  [K in keyof TState]: IStateVerifier;
};

function mappingToReducers<TState, TActions>(
  actions: TActions,
  mapping: ActionsToReducerMapping<TActions, TState>,
): Record<string, (state: TState, payload: unknown) => TState> {
  const reducers: Record<string, (state: TState, payload: unknown) => TState> = {};

  Object.entries<(state: TState, payload: unknown) => TState>(mapping).map((entry) => {
    const [actionKey, reducer] = entry;

    // NOTE(erri120): safe cast due to assertions before
    const action = actions[actionKey as keyof TActions] as ComplexActionCreator<unknown>;

    reducers[action.getType()] = reducer;
  });

  return reducers;
}

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
  return {
    defaults: defaultState,
    reducers: mappingToReducers(actions, mapping),
    verifiers,
  };
}

/**
 * Builds an IPartialReducerSpec from known actions, for a reducer that shares its slice with
 * others registered at the same path: it supplies defaults only for the fields it owns.
 * @public
 */
export function actionsToPartialReducerSpec<TState, TActions>(
  defaultState: Partial<TState>,
  actions: TActions,
  mapping: ActionsToReducerMapping<TActions, TState>,
  verifiers?: Partial<StateToVerifiers<TState>>,
): IPartialReducerSpec<TState> {
  return {
    defaults: defaultState,
    reducers: mappingToReducers(actions, mapping),
    verifiers,
  };
}

/** A reducer bound to its state path, which registers itself without losing its type. */
export interface IReducerBinding extends IExtensionReducer {
  register(context: Pick<IExtensionContext, "registerReducer">): void;
}

/**
 * Binds a reducer to its state path, checking at the call that the spec matches the slice there,
 * for an extension that keeps its reducers in a list (e.g. one a test harness also binds).
 */
export function reducerBinding<const P extends StatePath>(
  path: P,
  reducer: ReducerSpecFor<P>,
): IReducerBinding {
  return {
    path: [...path],
    reducer: reducer as IReducerSpec,
    register: (context) => context.registerReducer(path, reducer),
  };
}

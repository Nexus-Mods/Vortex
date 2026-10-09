/** A redux-act action creator that carries a typed payload. */
type PayloadAction = { getType(): string } & ((...args: never[]) => { payload: unknown });

/**
 * Curried builder for payload-typed reducer entries. Bind the state type once,
 * then pass an action + reducer; the payload type is inferred from the action, so
 * reducers avoid `as any` keys and per-entry payload annotations.
 *
 *   const on = reducerFor<MyState>();
 *   reducers: Object.fromEntries([on(actions.foo, (state, payload) => ...)])
 *
 * The returned reducer's payload is widened to `never` so every entry shares one
 * type and `Object.fromEntries` infers the reducers map cleanly.
 */
export function reducerFor<S>() {
  return <A extends PayloadAction>(
    action: A,
    reducer: (state: S, payload: ReturnType<A>["payload"]) => S,
  ): [string, (state: S, payload: never) => S] => [action.getType(), reducer];
}

# Renderer state (Redux)

How the renderer's Redux state is shaped, written and persisted: the state tree,
how to write and register a reducer, and how hydrated state is checked before it
reaches the store.

For how a _component_ reads state (selector rules, subscription granularity) see
[frontend.md](frontend.md#state-redux).

## The tree

State is divided into top-level hives, each owning a different lifetime.
`session` is the one to reach for when state should not survive a restart; which
hives persist to LevelDB is defined by `CORE_HIVES` in
`src/renderer/src/store/persistDiffMiddleware.ts`, and extensions can add hives
at hydration.

## Writing a reducer

Use `actionsToReducerSpec` from `src/renderer/src/reducers/builder.ts`. Its
advantage over a hand-rolled `IReducerSpec`: the handler's `payload` is typed
from the action creator rather than asserted.

`src/renderer/src/reducers/app.ts` is the model.

## Registering a reducer

Core reducers are mounted in `buildReducerTree` in
`src/renderer/src/reducers/index.ts`; extensions mount their own via
`IExtensionContext.registerReducer`, whose contract note spells out that the
call belongs first thing in `init`: registering anything that depends on state
before the state is registered produces failures that are hard to trace back.

## Verifiers

Verifiers run against **hydrated** state, not against dispatches: they are the
defence against a persisted value that has become the wrong shape across
versions, which would otherwise crash a reducer on startup. The verifier fields
and the repair context are documented on `IStateVerifier` in
`src/renderer/src/types/IExtensionContext.ts`.

`description` is what the user is shown when something is dropped, so write it
as a sentence about the data, not the code.

## Don't use the storeHelper path helpers

**Every path helper in `src/renderer/src/util/storeHelper.ts` is deprecated**
(`currentGame` is the only export that isn't); each `@deprecated` line names its
replacement.

## Adding to an old reducer

Many reducers still declare `IReducerSpec` directly and use the deprecated
helpers throughout. Adding a handler to one puts you in a file where every
surrounding line is `getSafe`/`setSafe`, so matching the file reads as the
consistent choice. Don't just mimic it: new code always uses the new style, and
while you are in an old reducer, converting the helpers in the parts you touch
(and fixing up related old issues) is welcome and moves the codebase forward.

## Key Files

| Path                                              | Purpose                                              |
| ------------------------------------------------- | ---------------------------------------------------- |
| `src/renderer/src/reducers/builder.ts`            | `actionsToReducerSpec`                               |
| `src/renderer/src/reducers/app.ts`                | The reference reducer                                |
| `src/renderer/src/reducers/index.ts`              | `buildReducerTree`, hydration, main-process pushes   |
| `src/renderer/src/reducers/verify.ts`             | Verifier evaluation                                  |
| `src/renderer/src/store/persistDiffMiddleware.ts` | Which hives persist, and the diff written to LevelDB |
| `src/renderer/src/util/storeHelper.ts`            | The deprecated path helpers                          |
| `src/renderer/src/types/IExtensionContext.ts`     | `IReducerSpec`, `IStateVerifier`, `registerReducer`  |

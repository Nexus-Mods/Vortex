# Renderer state (Redux)

How the renderer's Redux state is shaped, written and persisted: the state tree,
how to write and register a reducer, and how hydrated state is checked before it
reaches the store.

For how a _component_ reads state — selector rules, subscription granularity —
see [frontend.md](frontend.md#state-redux).

## The tree

State is divided into top-level hives, each owning a different lifetime:

| Hive           | Holds                                   | Persisted |
| -------------- | --------------------------------------- | --------- |
| `app`          | instance id, versions, extensions       | yes       |
| `user`         | user-level settings                     | yes       |
| `settings`     | anything the user configures            | yes       |
| `persistent`   | data Vortex owns: mods, downloads       | yes       |
| `confidential` | credentials                             | yes       |
| `session`      | this run only: notifications, discovery | no        |

`session` is the one to reach for when state should not survive a restart.
Everything else is written to LevelDB by `store/persistDiffMiddleware.ts`, whose
`CORE_HIVES` is the list above; extensions can add hives at hydration.

## Writing a reducer

Use `actionsToReducerSpec(defaults, actions, handlers, verifiers)` from
`reducers/builder.ts`. It takes the action creators as a namespace import and
maps each handler onto the action's type string, so the handler's `payload` is
typed from the action creator rather than asserted.

`src/renderer/src/reducers/app.ts` is the model:

```ts
export const appReducer = actionsToReducerSpec(
    defaultState,
    actions,
    {
        setApplicationVersion: (state, payload) => ({ ...state, appVersion: payload }),
        completeMigration: (state, payload) => ({
            ...state,
            migrations: [...state.migrations, payload],
        }),
    },
    { instanceId: { description: () => "No instance id set", type: "string" } },
);
```

A handler takes `(state, payload)` and returns a new object. Nested writes go
through a small named function rather than a path array — `updateExtension` in
`app.ts` is the pattern, and it is also where a guard lives ("entries are created
only by `addExtension`, so a write through a key naming none must not mint a
partial entry").

## Registering a reducer

Core reducers are mounted in `buildReducerTree` in `reducers/index.ts`, which
maps them onto their hive. Extensions mount their own:

```ts
context.registerReducer(["settings", "gameMode"], settingsReducer);
```

Call `registerReducer` first thing in `init`. Registering anything that depends
on state before the state is registered produces failures that are hard to trace
back — the contract note on `IExtensionContext.registerReducer` spells this out.

## Verifiers

The fourth argument to `actionsToReducerSpec` is a map of `IStateVerifier` keyed
by state key. Verifiers run against **hydrated** state, not against dispatches:
they are the defence against a persisted value that has become the wrong shape
across versions, which would otherwise crash a reducer on startup.

A verifier can assert `type`, `required`, `noUndefined`, `noNull` and `noEmpty`,
descend into `elements`, and on failure either `deleteBroken` (the entry or its
parent) or `repair` the value. `repair` receives a context carrying the
surrounding record's key, so a repair can recover a field from identity —
`mod_management/reducers/mods.ts` rebuilds a mod's `installationPath` from its
`modId` that way. `description` is what the user is shown when something is
dropped, so write it as a sentence about the data, not the code.

See `reducers/verify.ts` for the evaluation order.

## Don't use the storeHelper path helpers

**Every path helper in `src/renderer/src/util/storeHelper.ts` is deprecated** —
`getSafe`, `setSafe`, `merge`, `deleteOrNop`, `mutateSafe`, `setOrNop`,
`changeOrNop`, `pushSafe`, `addUniqueSafe`, `removeValue`, `removeValueIf`,
`setDefaultArray`, `getSafeCI` and `rehydrate`. `currentGame` is the only export
that isn't.

Each carries an `@deprecated` line naming its replacement. In practice that is
optional chaining and `??` to read, and spreads with computed keys to write:

```ts
// instead of getSafe(state, ["discovered", id, "path"], undefined)
state.discovered[id]?.path;

// instead of setSafe(state, ["discovered", id, "timestamp"], Date.now())
{
  ...state,
  discovered: {
    ...state.discovered,
    [id]: { ...state.discovered[id], timestamp: Date.now() },
  },
}
```

They take `state: any` and an untyped path array, so a mistyped path is a silent
no-op at runtime instead of a compile error. That is why they are going, and why
a "harmless" new call is worth avoiding.

## Adding to an old reducer

Roughly 12 reducers use the builder; around 46 still declare `IReducerSpec`
directly and use the deprecated helpers throughout.

**This is where the rule gets lost.** Adding a handler to an old reducer puts you
in a file where every surrounding line is `getSafe`/`setSafe`, so matching the
file reads as the consistent choice. Write the new style for what you add, and
leave the rest alone unless you are converting the whole reducer deliberately —
a conversion is its own change, with its own review.

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

# Redux State Guide (Beginner Friendly)

This folder stores all Stardew Valley extension state code.

If you are new to JavaScript/TypeScript, use this simple mental model:

- Action = "a message saying what happened"
- Reducer = "the code that updates saved data"
- Selector = "a helper that reads saved data"

You do not edit Redux state directly from UI code.
You dispatch an action, then the reducer updates the state.

## What Redux is (in 1 minute)

Redux is a shared app data store.

- The store is one big object.
- State is read-only from normal code.
- To change state, you dispatch an action.
- A reducer receives `currentState + actionPayload` and returns `nextState`.
- UI reads state and re-renders when state changes.

## What is in this folder

- `actions.ts`
    - Defines action creators for `settings.SDV` updates.
- `reducers.ts`
    - Handles those actions and writes to `settings.SDV`.
- `selectors.ts`
    - Reads nested values safely from Redux state.

## Real flow in this extension

Example: user enables "Manage SDV mod configuration files"

1. UI dispatches `setMergeConfigs(profileId, true)`.
2. Reducer handles that action.
3. Reducer writes `settings.SDV.mergeConfigs[profileId] = true`.
4. Other code reads the value and behaves accordingly.

## How to add a new setting (copy this pattern)

### Step 1: Add an action in `actions.ts`

```ts
export const setExampleFlag = createAction("SET_SDV_EXAMPLE_FLAG", (enabled: boolean) => enabled);
```

### Step 2: Handle it in `reducers.ts`

```ts
[actions.setExampleFlag as any]: (state, payload) => {
  return util.setSafe(state, ['exampleFlag'], payload);
},
```

Also add a default value:

```ts
defaults: {
  useRecommendations: false,
  exampleFlag: false,
}
```

### Step 3: Add a selector in `selectors.ts`

```ts
export function selectExampleFlag(state: types.IState): boolean {
    return util.getSafe(state, ["settings", "SDV", "exampleFlag"], false);
}
```

### Step 4: Use it in UI or feature code

Dispatch update:

```ts
store.dispatch(setExampleFlag(true));
```

Read current value:

```ts
const enabled = selectExampleFlag(state);
```

That is the full Redux cycle: dispatch -> reducer updates -> selector reads.

## Quick troubleshooting

- Setting does not change:
    - Check action name and reducer handler match.
- Value is always `undefined`:
    - Check selector path and reducer path are identical.
- UI does not update:
    - Confirm UI reads the Redux value (not local variable only).

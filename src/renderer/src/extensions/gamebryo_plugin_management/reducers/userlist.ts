import { actionsToReducerSpec } from "../../../reducers/builder";
import type { IReducerSpec } from "../../../types/IExtensionContext";
import * as actions from "../actions/userlist";
import type { ILOOTList } from "../types/ILOOTList";

declare module "@/types/IState" {
  interface IState {
    // the user's LOOT rules, persisted to the userlist file
    userlist: ILOOTList;
  }
}

function listForType(type: string) {
  switch (type) {
    case "requires":
      return "req";
    case "incompatible":
      return "inc";
    default:
      return "after";
  }
}

// a list read from the state that should be an array, as an empty one when it isn't
function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function pluginIndex(state: ILOOTList, pluginId: string): number {
  return state.plugins !== undefined
    ? state.plugins.findIndex((plug) => plug.name.toUpperCase() === pluginId.toUpperCase())
    : -1;
}

// removes the first occurrence of value from the after-list of the group at idx; the same state
// when it isn't there
function removeGroupAfter(state: ILOOTList, idx: number, value: string): ILOOTList {
  const group = state.groups[idx];
  const after = asArray(group.after);
  const pos = after.indexOf(value);
  if (pos === -1) {
    return state;
  }
  return { ...state, groups: state.groups.with(idx, { ...group, after: after.toSpliced(pos, 1) }) };
}

/**
 * reducer for changes to settings regarding mods
 */
const userlistSpec = actionsToReducerSpec<ILOOTList, typeof actions>(
  { plugins: [], groups: [] },
  actions,
  {
    addRule: (state, payload) => {
      const existing = pluginIndex(state, payload.pluginId);
      const list = listForType(payload.type);
      if (existing !== -1) {
        const plugin = state.plugins[existing];
        const refs = asArray(plugin[list]);
        if (refs.indexOf(payload.reference) !== -1) {
          return state;
        }
        return {
          ...state,
          plugins: state.plugins.with(existing, {
            ...plugin,
            [list]: [...refs, payload.reference],
          }),
        };
      } else {
        return {
          ...state,
          plugins: [
            ...asArray(state.plugins),
            { name: payload.pluginId, [list]: [payload.reference] },
          ],
        };
      }
    },
    removeRule: (state, payload) => {
      const existing = pluginIndex(state, payload.pluginId);
      const list = listForType(payload.type);
      if (existing !== -1) {
        const plugin = state.plugins[existing];
        const target = payload.reference.toUpperCase();
        // rules from a LOOT userlist file can be references with a condition, not just names
        const remaining = asArray(plugin[list]).filter(
          (ref) => (typeof ref === "string" ? ref : ref?.name)?.toUpperCase() !== target,
        );
        return {
          ...state,
          plugins: state.plugins.with(existing, { ...plugin, [list]: remaining }),
        };
      } else {
        return state;
      }
    },
    addGroup: (state, payload) =>
      state.groups.find((group) => group.name.toUpperCase() === payload.group.toUpperCase()) ===
      undefined
        ? { ...state, groups: [...state.groups, { name: payload.group, after: [] }] }
        : state,
    removeGroup: (state, payload) => {
      // need to remove the group from all rules
      state.groups.forEach((group, idx) => {
        state = removeGroupAfter(state, idx, payload.group);
      });

      const inGroup = (plugin: ILOOTList["plugins"][number]) =>
        plugin.group !== undefined &&
        payload.group !== undefined &&
        plugin.group.toUpperCase() === payload.group.toUpperCase();
      if (state.plugins.some(inGroup)) {
        state = {
          ...state,
          plugins: state.plugins.map((plugin) =>
            inGroup(plugin) ? { ...plugin, group: "default" } : plugin,
          ),
        };
      }

      return {
        ...state,
        groups: (state.groups ?? []).filter(
          (group) => group.name.toUpperCase() !== payload.group.toUpperCase(),
        ),
      };
    },
    setGroup: (state, payload) => {
      const existing = pluginIndex(state, payload.pluginId);

      if (payload.group === undefined) {
        if (existing === -1 || !Object.hasOwn(state.plugins[existing], "group")) {
          return state;
        }
        const { group: _group, ...rest } = state.plugins[existing];
        return { ...state, plugins: state.plugins.with(existing, rest) };
      }

      return existing !== -1
        ? {
            ...state,
            plugins: state.plugins.with(existing, {
              ...state.plugins[existing],
              group: payload.group,
            }),
          }
        : {
            ...state,
            plugins: [...asArray(state.plugins), { name: payload.pluginId, group: payload.group }],
          };
    },
    addGroupRule: (state, payload) => {
      const idx = state.groups.findIndex(
        (group) => group.name.toUpperCase() === payload.groupId.toUpperCase(),
      );
      if (idx === -1) {
        return {
          ...state,
          groups: [...state.groups, { name: payload.groupId, after: [payload.reference] }],
        };
      } else {
        const group = state.groups[idx];
        const after = asArray(group.after);
        if (after.indexOf(payload.reference) !== -1) {
          return state;
        }
        return {
          ...state,
          groups: state.groups.with(idx, { ...group, after: [...after, payload.reference] }),
        };
      }
    },
    clearUserlist: () => ({ plugins: [], groups: [] }),
    removeGroupRule: (state, payload) => {
      const idx = state.groups.findIndex(
        (group) => group.name.toUpperCase() === payload.groupId.toUpperCase(),
      );
      if (idx === -1) {
        return state;
      }
      return removeGroupAfter(state, idx, payload.reference);
    },
  },
);

const userlistReducer: IReducerSpec<ILOOTList> = {
  ...userlistSpec,
  reducers: {
    ...userlistSpec.reducers,
    // a full userlist handed over on rehydration replaces the current one
    ["persist/REHYDRATE"]: (state, payload: { userlist?: ILOOTList }) => {
      if (payload.hasOwnProperty("userlist")) {
        return { ...payload.userlist };
      } else {
        return state;
      }
    },
  },
};

export default userlistReducer;

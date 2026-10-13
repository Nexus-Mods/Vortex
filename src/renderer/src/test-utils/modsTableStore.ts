import { type AnyAction, createStore } from "redux";

import type { ICategoryDictionary } from "@/extensions/category_management/types/ICategoryDictionary";
import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IModsTableViewsState } from "@/extensions/mod_management/reducers/modsTableViews";
import { modsTableViewsReducer } from "@/extensions/mod_management/reducers/modsTableViews";
import { tableReducer } from "@/reducers/tables";
import { toolbarReducer } from "@/reducers/toolbars";

/** Each table's column choices, as `settings.tables` keeps them. */
export interface IModsTableTestTables {
  [tableId: string]: { attributes?: { [columnId: string]: { enabled: boolean } } };
}

export const MODS_TABLE_TEST_GAME = "game";

/**
 * A store with what the new Mods table reads: its views in `settings.modsTableViews`, the
 * rows' pins in `settings.toolbars` and the legacy table's columns in `settings.tables`, which
 * it changes, and a game's mods, downloads and categories, which it only reads. The beta view
 * is on unless `betaTable` says not.
 */
export const makeModsTableStore = ({
  tables = {},
  downloads = {},
  categories = {},
  modState,
  mods = {},
  betaTable = true,
  activity = {},
  views = modsTableViewsReducer.defaults,
}: {
  tables?: IModsTableTestTables;
  downloads?: { [id: string]: Partial<IDownload> };
  categories?: ICategoryDictionary;
  modState?: { [modId: string]: { enabled: boolean } };
  mods?: { [modId: string]: object };
  betaTable?: boolean;
  /** What's under way, by group, as `session.base.activity` lists it. */
  activity?: { [group: string]: string[] };
  /** The new table's views, as `settings.modsTableViews` keeps them. */
  views?: IModsTableViewsState;
} = {}) => {
  const initial = {
    settings: {
      tables,
      toolbars: {},
      modsTableViews: views,
      profiles: { activeProfileId: "profile" },
      mods: { betaTable },
    },
    session: { base: { activity } },
    persistent: {
      profiles: { profile: { gameId: MODS_TABLE_TEST_GAME, modState } },
      downloads: { files: downloads },
      categories: { [MODS_TABLE_TEST_GAME]: categories },
      mods: { [MODS_TABLE_TEST_GAME]: mods },
    },
  };

  // The settings the table changes, each by its own reducer.
  const settingsReducers = {
    tables: tableReducer,
    toolbars: toolbarReducer,
    modsTableViews: modsTableViewsReducer,
  } as const;

  return createStore((state: typeof initial = initial, action: AnyAction) => {
    for (const [slice, spec] of Object.entries(settingsReducers)) {
      const reduce = spec.reducers[action.type];
      if (reduce) {
        return {
          ...state,
          settings: { ...state.settings, [slice]: reduce(state.settings[slice], action.payload) },
        };
      }
    }
    return state;
  });
};

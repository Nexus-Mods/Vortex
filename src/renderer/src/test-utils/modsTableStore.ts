import { type AnyAction, createStore } from "redux";

import type { ICategoryDictionary } from "@/extensions/category_management/types/ICategoryDictionary";
import type { IDownload } from "@/extensions/download_management/types/IDownload";
import { tableReducer } from "@/reducers/tables";

/** Each table's column choices, as `settings.tables` keeps them. */
export interface IModsTableTestTables {
  [tableId: string]: { attributes?: { [columnId: string]: { enabled: boolean } } };
}

export const MODS_TABLE_TEST_GAME = "game";

/**
 * A store with what the new Mods table reads: the column choices in `settings.tables`,
 * which it changes, and a game's downloads and categories, which it only reads.
 */
export const makeModsTableStore = ({
  tables = {},
  downloads = {},
  categories = {},
  modState,
}: {
  tables?: IModsTableTestTables;
  downloads?: { [id: string]: Partial<IDownload> };
  categories?: ICategoryDictionary;
  modState?: { [modId: string]: { enabled: boolean } };
} = {}) => {
  const initial = {
    settings: { tables, profiles: { activeProfileId: "profile" } },
    persistent: {
      profiles: { profile: { gameId: MODS_TABLE_TEST_GAME, modState } },
      downloads: { files: downloads },
      categories: { [MODS_TABLE_TEST_GAME]: categories },
    },
  };

  return createStore((state: typeof initial = initial, action: AnyAction) => {
    const reduce = tableReducer.reducers[action.type];
    return reduce
      ? {
          ...state,
          settings: { ...state.settings, tables: reduce(state.settings.tables, action.payload) },
        }
      : state;
  });
};

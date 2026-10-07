import { type AnyAction, createStore } from "redux";

import type { ICategoryDictionary } from "@/extensions/category_management/types/ICategoryDictionary";
import type { IDownload } from "@/extensions/download_management/types/IDownload";
import { tableReducer } from "@/reducers/tables";
import { toolbarReducer } from "@/reducers/toolbars";

/** Each table's column choices, as `settings.tables` keeps them. */
export interface IModsTableTestTables {
  [tableId: string]: { attributes?: { [columnId: string]: { enabled: boolean } } };
}

export const MODS_TABLE_TEST_GAME = "game";

/**
 * A store with what the new Mods table reads: the column choices in `settings.tables` and
 * the rows' pins in `settings.toolbars`, which it changes, and a game's mods, downloads
 * and categories, which it only reads.
 */
export const makeModsTableStore = ({
  tables = {},
  downloads = {},
  categories = {},
  modState,
  mods = {},
}: {
  tables?: IModsTableTestTables;
  downloads?: { [id: string]: Partial<IDownload> };
  categories?: ICategoryDictionary;
  modState?: { [modId: string]: { enabled: boolean } };
  mods?: { [modId: string]: object };
} = {}) => {
  const initial = {
    settings: { tables, toolbars: {}, profiles: { activeProfileId: "profile" } },
    persistent: {
      profiles: { profile: { gameId: MODS_TABLE_TEST_GAME, modState } },
      downloads: { files: downloads },
      categories: { [MODS_TABLE_TEST_GAME]: categories },
      mods: { [MODS_TABLE_TEST_GAME]: mods },
    },
  };

  return createStore((state: typeof initial = initial, action: AnyAction) => {
    const reduceTables = tableReducer.reducers[action.type];
    if (reduceTables) {
      return {
        ...state,
        settings: {
          ...state.settings,
          tables: reduceTables(state.settings.tables, action.payload),
        },
      };
    }

    const reduceToolbars = toolbarReducer.reducers[action.type];
    return reduceToolbars
      ? {
          ...state,
          settings: {
            ...state.settings,
            toolbars: reduceToolbars(state.settings.toolbars, action.payload),
          },
        }
      : state;
  });
};

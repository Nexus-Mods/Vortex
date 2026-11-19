import { VortexGameId } from "@vortex/shared";
import { type AnyAction, createStore } from "redux";

import type { ICategoryDictionary } from "@/extensions/category_management/types/ICategoryDictionary";
import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IModsTableViewsState } from "@/extensions/mod_management/reducers/modsTableViews";
import { modsTableViewsReducer } from "@/extensions/mod_management/reducers/modsTableViews";
import { sessionReducer } from "@/extensions/mod_management/reducers/session";
import { settingsReducer as modsSettingsReducer } from "@/extensions/mod_management/reducers/settings";
import { tableReducer } from "@/reducers/tables";
import { toolbarReducer } from "@/reducers/toolbars";

/** Each table's column choices and filters, as `settings.tables` keeps them. */
export interface IModsTableTestTables {
  [tableId: string]: {
    attributes?: { [columnId: string]: { enabled: boolean } };
    filter?: { [columnId: string]: unknown };
  };
}

export const MODS_TABLE_TEST_GAME = VortexGameId("game");

/**
 * A store with what the new Mods table reads: its views in `settings.modsTableViews`, the
 * rows' pins in `settings.toolbars` and the legacy table's columns in `settings.tables`, which
 * it changes, and a request to show a group in `session.mods`, and a game's mods, downloads and
 * categories, which it only reads. The beta view is on unless `betaTable` says not, and the
 * Properties panel, kept in `settings.mods`, is closed unless `propertiesOpen` says not.
 */
export const makeModsTableStore = ({
  tables = {},
  downloads = {},
  categories = {},
  modState,
  mods = {},
  betaTable = true,
  propertiesOpen = false,
  knownGames = [],
  discovered = {},
  activity = {},
  views = modsTableViewsReducer.defaults,
  focusedGroupId,
  focusedModId,
  gameId = MODS_TABLE_TEST_GAME,
}: {
  tables?: IModsTableTestTables;
  downloads?: { [id: string]: Partial<IDownload> };
  categories?: ICategoryDictionary;
  modState?: { [modId: string]: { enabled: boolean } };
  mods?: { [modId: string]: object };
  betaTable?: boolean;
  /** Whether the Properties panel was left open, as `settings.mods.propertiesOpen` keeps it. */
  propertiesOpen?: boolean;
  /** The games Vortex supports, as `session.gameMode.known` lists them. */
  knownGames?: object[];
  /** Where each game is installed, as `settings.gameMode.discovered` keeps it. */
  discovered?: Partial<Record<VortexGameId, object>>;
  /** What's under way, by group, as `session.base.activity` lists it. */
  activity?: { [group: string]: string[] };
  /** The new table's views, as `settings.modsTableViews` keeps them. */
  views?: IModsTableViewsState;
  /** A group the table is asked to show, as `session.mods.focusedGroupId` keeps it. */
  focusedGroupId?: string;
  /** A mod the table is asked to show, as `session.mods.focusedModId` keeps it. */
  focusedModId?: string;
  /** The active profile's game, which its mods and categories are kept under. */
  gameId?: VortexGameId;
} = {}) => {
  const initial = {
    settings: {
      tables,
      toolbars: {},
      modsTableViews: views,
      profiles: { activeProfileId: "profile" },
      mods: { betaTable, propertiesOpen, installPath: {} },
      gameMode: { discovered },
    },
    session: {
      base: { activity },
      gameMode: { known: knownGames },
      mods: { ...sessionReducer.defaults, focusedGroupId, focusedModId },
    },
    persistent: {
      profiles: { profile: { gameId, modState } },
      downloads: { files: downloads },
      gameMode: { tier0: {} },
      categories: { [gameId]: categories },
      mods: { [gameId]: mods },
    },
  };

  // The settings the table changes, each by its own reducer.
  const settingsReducers = {
    tables: tableReducer,
    toolbars: toolbarReducer,
    modsTableViews: modsTableViewsReducer,
    mods: modsSettingsReducer,
  } as const;

  return createStore((state: typeof initial = initial, action: AnyAction) => {
    const reduceSession = sessionReducer.reducers[action.type];
    if (reduceSession) {
      return {
        ...state,
        session: { ...state.session, mods: reduceSession(state.session.mods, action.payload) },
      };
    }
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

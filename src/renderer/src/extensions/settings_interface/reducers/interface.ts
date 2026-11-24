import { actionsToPartialReducerSpec, setField } from "@/reducers/builder";
import type { ISettingsInterface } from "@/types/IState";

import * as actions from "../actions/interface";

/**
 * reducer for changes to interface settings
 *
 * settings.interface is shared: the dashboard owns the layout and dashlet settings, the starter
 * dashlet the tools and primary tool, so this reducer supplies defaults only for its own fields.
 */
const settingsReducer = actionsToPartialReducerSpec<ISettingsInterface, typeof actions>(
  {
    language: "en",
    advanced: false,
    profilesVisible: true,
    desktopNotifications: false,
    hideTopLevelCategory: false,
    relativeTimes: true,
    foregroundDL: true,
    alwaysCompactHeaders: false,
    showGameArt: true,
    usage: {},
  },
  actions,
  {
    setLanguage: (state, payload) => setField(state, "language", payload),
    setAdvancedMode: (state, payload) => setField(state, "advanced", payload.advanced),
    setProfilesVisible: (state, payload) => setField(state, "profilesVisible", payload.visible),
    setDesktopNotifications: (state, payload) => setField(state, "desktopNotifications", payload),
    setHideTopLevelCategory: (state, payload) =>
      setField(state, "hideTopLevelCategory", payload.hide),
    showUsageInstruction: (state, payload) =>
      state.usage !== undefined &&
      setField(state.usage, payload.usageId, payload.show) === state.usage
        ? state
        : { ...state, usage: { ...state.usage, [payload.usageId]: payload.show } },
    setRelativeTimes: (state, payload) => setField(state, "relativeTimes", payload),
    setForegroundDL: (state, payload) => setField(state, "foregroundDL", payload),
    setAlwaysCompactHeaders: (state, payload) => setField(state, "alwaysCompactHeaders", payload),
    setShowGameArt: (state, payload) => setField(state, "showGameArt", payload),
    // Deliberately absent from the defaults above: unset means "follow the OS".
    setReduceMotion: (state, payload) => setField(state, "reduceMotion", payload),
    setLastPage: (state, { pageId, gameId }) => {
      const { lastPages } = state;
      if (gameId === undefined) {
        return lastPages?.home === pageId
          ? state
          : { ...state, lastPages: { ...lastPages, home: pageId } };
      }
      return lastPages?.games?.[gameId] === pageId
        ? state
        : {
            ...state,
            lastPages: { ...lastPages, games: { ...lastPages?.games, [gameId]: pageId } },
          };
    },
  },
);

export default settingsReducer;

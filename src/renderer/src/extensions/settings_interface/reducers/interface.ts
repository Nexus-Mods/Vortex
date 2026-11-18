import { actionsToPartialReducerSpec } from "@/reducers/builder";
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
    setLanguage: (state, payload) => ({ ...state, language: payload }),
    setAdvancedMode: (state, payload) => ({ ...state, advanced: payload.advanced }),
    setProfilesVisible: (state, payload) => ({ ...state, profilesVisible: payload.visible }),
    setDesktopNotifications: (state, payload) => ({ ...state, desktopNotifications: payload }),
    setHideTopLevelCategory: (state, payload) => ({ ...state, hideTopLevelCategory: payload.hide }),
    showUsageInstruction: (state, payload) => ({
      ...state,
      usage: { ...state.usage, [payload.usageId]: payload.show },
    }),
    setRelativeTimes: (state, payload) => ({ ...state, relativeTimes: payload }),
    setForegroundDL: (state, payload) => ({ ...state, foregroundDL: payload }),
    setAlwaysCompactHeaders: (state, payload) => ({ ...state, alwaysCompactHeaders: payload }),
    setShowGameArt: (state, payload) => ({ ...state, showGameArt: payload }),
    // Deliberately absent from the defaults above: unset means "follow the OS".
    setReduceMotion: (state, payload) => ({ ...state, reduceMotion: payload }),
  },
);

export default settingsReducer;

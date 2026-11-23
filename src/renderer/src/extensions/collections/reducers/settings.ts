import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/settings";

/** settings.collections: how the collections page sorts its lists */
export interface ISettingsCollections {
  // sort order of the "added collections" list
  sortAdded: string;
  // sort order of the workshop (own collections) list
  sortWorkshop: string;
}

declare module "@/types/IState" {
  interface ISettings {
    collections: ISettingsCollections;
  }
}

const settingsReducer = actionsToReducerSpec<ISettingsCollections, typeof actions>(
  {
    sortAdded: "datedownloaded",
    sortWorkshop: "recentlyupdated",
  },
  actions,
  {
    setSortAdded: (state, payload) => ({ ...state, sortAdded: payload.sorting }),
    setSortWorkshop: (state, payload) => ({ ...state, sortWorkshop: payload.sorting }),
  },
);

export default settingsReducer;

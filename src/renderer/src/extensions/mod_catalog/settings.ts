import safeCreateAction from "../../actions/safeCreateAction";
import type { IReducerSpec } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import { setSafe } from "../../util/storeHelper";

/** Show adult (18+) mods in the catalog. Off unless the user turns it on. */
export const setCatalogShowAdult = safeCreateAction(
  "MKEIITMODS_SET_CATALOG_SHOW_ADULT",
  (show: boolean) => show,
);

export const catalogSettingsReducer: IReducerSpec = {
  reducers: {
    [setCatalogShowAdult as any]: (state, payload: boolean) =>
      setSafe(state, ["showAdult"], payload === true),
  },
  defaults: {
    showAdult: false,
  },
};

export function catalogShowAdult(state: IState): boolean {
  const settings = (state.settings as unknown as Record<string, { showAdult?: boolean }>)
    .modCatalog;
  return settings?.showAdult === true;
}

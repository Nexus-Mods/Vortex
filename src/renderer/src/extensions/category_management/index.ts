import type * as Redux from "redux";

import { setDialogVisible } from "@/actions";

import type { IExtensionContext } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import type { TFunction } from "../../util/i18n";
import { log } from "../../util/log";
import { showError } from "../../util/message";
import { activeGameId } from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";
import { setDownloadModInfo } from "../download_management/actions/state";
import { setModAttribute } from "../mod_management/actions/mods";
import type { IModWithState } from "../mod_management/types/IModProps";
import { isLoggedIn } from "../nexus_integration/selectors";
import { loadCategories, updateCategories } from "./actions/category";
import { categoryReducer } from "./reducers/category";
import { allCategories } from "./selectors";
import type { ICategoryDictionary } from "./types/ICategoryDictionary";
import CategoryFilter from "./util/CategoryFilter";
import { resolveCategoryName, resolveCategoryPath } from "./util/retrieveCategoryPath";
import CategoryDialog from "./views/CategoryDialog";

// export for api
export { resolveCategoryName, resolveCategoryPath };

const getModCategory = (mod: IModWithState): string | number | undefined =>
  mod.attributes?.category;

const getModName = (mod: IModWithState): string | undefined =>
  mod.attributes?.name || mod.attributes?.fileName;

function getCategoryChoices(state: IState) {
  const categories: ICategoryDictionary = allCategories(state);

  return [{ key: "", text: "" }].concat(
    Object.keys(categories)
      .map((id) => ({ key: id, text: resolveCategoryPath(id, state) }))
      .sort((lhs, rhs) => categories[lhs.key].order - categories[rhs.key].order),
  );
}

function undefSort(lhs?: string, rhs?: string) {
  return lhs !== undefined ? 1 : rhs !== undefined ? -1 : 0;
}

function modNameSort(
  lhs: IModWithState,
  rhs: IModWithState,
  collator: Intl.Collator,
  sortDir: string,
): number {
  const lhsName = getModName(lhs);
  const rhsName = getModName(rhs);
  return lhsName === undefined || rhsName === undefined
    ? undefSort(lhsName, rhsName)
    : collator.compare(lhsName, rhsName) * (sortDir !== "desc" ? 1 : -1);
}

function sortCategories(
  lhs: IModWithState,
  rhs: IModWithState,
  collator: Intl.Collator,
  state: IState,
  sortDir: string,
): number {
  const lhsCat = resolveCategoryName(getModCategory(lhs), state);
  const rhsCat = resolveCategoryName(getModCategory(rhs), state);
  return lhsCat === rhsCat
    ? modNameSort(lhs, rhs, collator, sortDir)
    : collator.compare(lhsCat, rhsCat);
}

function init(context: IExtensionContext): boolean {
  let sortDirection: string = "none";
  let lang: string;
  let collator: Intl.Collator;
  const getCollator = (locale: string) => {
    if (collator === undefined || locale !== lang) {
      lang = locale;
      collator = new Intl.Collator(locale, { sensitivity: "base" });
    }
    return collator;
  };

  context.registerReducer(["persistent", "categories"], categoryReducer);

  context.registerDialog("categories", CategoryDialog);
  context.registerAction("mod-icons", 80, "categories", {}, "Categories", () => {
    context.api.store.dispatch(setDialogVisible("categories"));
  });

  context.registerTableAttribute("mods", {
    id: "category",
    name: "Category",
    description: "Mod Category",
    icon: "sitemap",
    placement: "table",
    calc: (mod: IModWithState) => resolveCategoryName(getModCategory(mod), context.api.getState()),
    isToggleable: true,
    edit: {},
    isSortable: true,
    isGroupable: (mod: IModWithState, t: TFunction) =>
      resolveCategoryName(getModCategory(mod), context.api.getState()) || t("<No category>"),
    filter: new CategoryFilter(),
    sortFuncRaw: (lhs: IModWithState, rhs: IModWithState, locale: string): number =>
      sortCategories(lhs, rhs, getCollator(locale), context.api.getState(), sortDirection),
  });

  context.registerTableAttribute("mods", {
    id: "category-detail",
    name: "Category",
    description: "Mod Category",
    icon: "sitemap",
    supportsMultiple: true,
    calc: (mod: IModWithState) => resolveCategoryPath(getModCategory(mod), context.api.getState()),
    edit: {
      choices: () => getCategoryChoices(context.api.getState()),
      onChangeValue: (rows: IModWithState[], newValue: string | number) => {
        const gameMode = activeGameId(context.api.getState());
        rows.forEach((row) => {
          if (row.state === "downloaded") {
            context.api.store.dispatch(setDownloadModInfo(row.id, "custom.category", newValue));
          } else {
            context.api.store.dispatch(setModAttribute(gameMode, row.id, "category", newValue));
          }
        });
      },
    },
    externalData: (onChanged: () => void) => {
      context.api.onStateChange(["settings", "interface", "hideTopLevelCategory"], () => {
        onChanged();
      });
    },
    placement: "detail",
    isToggleable: false,
    isVolatile: true,
    isSortable: true,
  });

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;
    context.api.onStateChange(["settings", "tables", "mods"], (oldState, newState) => {
      const newSortDirection = getSafe(
        newState,
        ["attributes", "category", "sortDirection"],
        "none",
      );

      const oldSortDirection = getSafe(
        oldState,
        ["attributes", "category", "sortDirection"],
        "none",
      );

      if (newSortDirection !== oldSortDirection) {
        sortDirection = newSortDirection;
      }
    });
    try {
      context.api.events.on(
        "update-categories",
        (gameId: string, categories: ICategoryDictionary, isUpdate: boolean) => {
          if (isUpdate) {
            context.api.store.dispatch(updateCategories(gameId, categories));
          } else {
            context.api.store.dispatch(loadCategories(gameId, categories));
          }
        },
      );

      context.api.events.on("gamemode-activated", (gameMode: string) => {
        const categories: ICategoryDictionary =
          context.api.getState().persistent.categories[gameMode];
        if (categories === undefined && isLoggedIn(context.api.getState())) {
          context.api.events.emit("retrieve-category-list", false, {});
        } else if (categories !== undefined && Object.values(categories).length === 0) {
          context.api.store.dispatch(updateCategories(gameMode, {}));
        }
      });
    } catch (err) {
      log("error", "Failed to load categories", err);
      showError(store.dispatch, "Failed to load categories", err);
    }
  });

  return true;
}

export default init;

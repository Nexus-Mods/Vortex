import { createSelector } from "reselect";

import type { IState } from "@/types/IState";

import { allCategories } from "../../selectors";
import { categoryPathIn } from "../retrieveCategoryPath";

/** A category to pick: its id, and its path as the user reads it. */
export interface ICategoryChoice {
  /** Its id, as a mod's `category` attribute keeps it. */
  value: string;
  /** Its path, e.g. "Armour > Heavy". */
  label: string;
}

const hideTopLevelCategory = (state: IState) =>
  state.settings.interface?.hideTopLevelCategory ?? false;

/**
 * The active game's categories to pick from, in the order the user arranged them. Built again only
 * once the categories, or whether their top level is shown, change.
 */
export const categoryChoices = createSelector(
  [allCategories, hideTopLevelCategory],
  (categories, hideTopLevel): ICategoryChoice[] =>
    Object.keys(categories)
      .sort((lhs, rhs) => categories[lhs].order - categories[rhs].order)
      .map((id) => ({ value: id, label: categoryPathIn(categories, id, hideTopLevel) })),
);

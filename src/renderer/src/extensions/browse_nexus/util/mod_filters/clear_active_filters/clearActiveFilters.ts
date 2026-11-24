import { type IModFilters, type IResolvedModView, NO_FILTERS } from "../../mod_views/modViews";

/**
 * The change that clears every filter narrowing the mods, a view's own too. A locked filter isn't
 * among them, so it's never touched.
 */
export const clearActiveFilters = ({
  activeFilters,
}: Pick<IResolvedModView, "activeFilters">): Partial<IModFilters> =>
  Object.fromEntries(activeFilters.map((key) => [key, NO_FILTERS[key]]));

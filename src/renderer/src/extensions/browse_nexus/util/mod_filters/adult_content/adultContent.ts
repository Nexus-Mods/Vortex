import type { TFunction } from "i18next";

import type { IAdultContentAccess, IModFilter } from "../modFilter.types";

/**
 * Why a user can't see adult content, as the website words it: logged out, or turned off in their
 * preferences; nothing while they can.
 */
export const adultContentLockedReason = (
  t: TFunction,
  { canSeeAdult, isLoggedIn }: IAdultContentAccess,
) => {
  if (!isLoggedIn) {
    return t("Log in to view adult content");
  }

  if (!canSeeAdult) {
    return t("Adult content is disabled in your preferences");
  }

  return undefined;
};

/**
 * The adult content filter: adult mods shown alongside the rest, left out, or shown alone. Locked
 * on leaving them out for a user who can't see them, as on the website. The search leaves the
 * default out, so it asks as it did before there was a choice.
 */
export const adultContentFilter: IModFilter<"adult", "adult"> = {
  key: "adult",
  label: (t) => t("Adult content"),
  icon: "blur_on",
  choices: (t) => [
    { value: "include", label: t("Show all content"), short: t("All content") },
    { value: "exclude", label: t("Hide adult content"), short: t("No adult content") },
    { value: "only", label: t("Show only adult content"), short: t("Adult content only") },
  ],
  resetLabel: (t) => t("Reset adult content to default"),
  removeLabel: (t) => t("Remove adult content filter"),
  lockedReason: adultContentLockedReason,
  toSearch: (filters) => (filters.adult === "include" ? {} : { adult: filters.adult }),
  eventProps: (filters) => ({ adult: filters.adult }),
  track: (tracker, { view, filters, previous, source }) =>
    tracker.trackAdultFilterChanged({
      view,
      adult: filters.adult,
      previous_adult: previous.adult,
      source,
    }),
};

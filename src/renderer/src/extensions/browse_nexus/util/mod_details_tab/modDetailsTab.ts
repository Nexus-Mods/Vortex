/** The tabs of a mod's details, by their panel ids. */
export const MOD_DETAILS_TABS = ["details", "comments"] as const;

export type ModDetailsTab = (typeof MOD_DETAILS_TABS)[number];

/** Whether a tab panel id is one of a mod's details' tabs. */
export const isModDetailsTab = (tab: string): tab is ModDetailsTab =>
  (MOD_DETAILS_TABS as readonly string[]).includes(tab);

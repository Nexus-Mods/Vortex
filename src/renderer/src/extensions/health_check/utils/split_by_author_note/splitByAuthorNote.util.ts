import type { IBulkInstallItem } from "../../views/content/types";

/**
 * Splits an install all by whether the mod's author left a note. Unnoted mods install
 * straight away; noted ones are often optional, so they wait for the author notes review.
 */
export const splitByAuthorNote = (
  items: IBulkInstallItem[],
): { noted: IBulkInstallItem[]; unnoted: IBulkInstallItem[] } => ({
  noted: items.filter((item) => item.notedRequirement),
  unnoted: items.filter((item) => !item.notedRequirement),
});

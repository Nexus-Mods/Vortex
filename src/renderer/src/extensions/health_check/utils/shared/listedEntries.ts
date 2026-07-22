import type { IState } from "@/types/IState";

import { healthCheckContent } from "../../views/content/registry";
import type { IHealthCheckContent, IHealthCheckEntry } from "../../views/content/types";

/** One listing entry paired with the content provider that owns it. */
export interface IListedEntry {
  entry: IHealthCheckEntry;
  content: IHealthCheckContent;
  hidden: boolean;
}

/** Gather entries from every registered health-check content provider. */
export const selectListedEntries = (state: IState): IListedEntry[] => {
  const items: IListedEntry[] = [];
  for (const content of Object.values(healthCheckContent)) {
    if (!content) {
      continue;
    }
    for (const entry of content.selectEntries(state)) {
      items.push({ entry, content, hidden: content.isHidden?.(state, entry) ?? false });
    }
  }
  return items;
};

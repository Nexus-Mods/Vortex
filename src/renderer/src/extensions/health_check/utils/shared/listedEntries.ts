import type { IState } from "@/types/IState";

import { healthCheckContent } from "../../views/content/registry";
import type { IHealthCheckContent, IHealthCheckEntry } from "../../views/content/types";
import { issueTypeForCheck } from "./tracking";

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

/** Issue totals split by confidence band, as the page and scan events report them. */
export interface IIssueCounts {
  total: number;
  warning: number;
  suggestion: number;
}

/** Split a set of listing entries into warning / suggestion totals. */
export const countIssues = (items: IListedEntry[]): IIssueCounts => {
  const warning = items.filter(
    (item) => issueTypeForCheck(item.entry.checkId) === "warning",
  ).length;

  return { total: items.length, warning, suggestion: items.length - warning };
};

import * as Redux from "redux";

import { removeGroupRule, setGroup } from "../actions/userlist";
import { IStateWithGamebryo } from "../types/IStateWithGamebryo";

/**
 * Find every reference in the userlist to a LOOT group that doesn't exist in either the
 * masterlist or the userlist. These dangling references happen e.g. when a collection assigns
 * plugins to a masterlist group that was later renamed or removed - LOOT then refuses to sort
 * with 'The group "..." does not exist'.
 *
 * Returns the names of the missing groups (for reporting) along with the userlist actions needed
 * to drop the references, resetting the affected plugins back to their default group.
 */
export function missingGroupFixes(state: IStateWithGamebryo): {
  missing: string[];
  actions: Redux.AnyAction[];
} {
  const userlistGroups = state.userlist?.groups ?? [];

  // all groups that actually exist
  const known = new Set<string>([
    ...(state.masterlist?.groups ?? []).map((group) => group.name),
    ...userlistGroups.map((group) => group.name),
  ]);

  const missing = new Set<string>();
  const actions: Redux.AnyAction[] = [];

  (state.userlist?.plugins ?? [])
    .filter((plugin) => plugin.group !== undefined && !known.has(plugin.group))
    .forEach((plugin) => {
      missing.add(plugin.group);
      actions.push(setGroup(plugin.name, undefined));
    });

  userlistGroups.forEach((group) => {
    (group.after ?? [])
      .filter((after) => !known.has(after))
      .forEach((after) => {
        missing.add(after);
        actions.push(removeGroupRule(group.name, after));
      });
  });

  return { missing: Array.from(missing), actions };
}

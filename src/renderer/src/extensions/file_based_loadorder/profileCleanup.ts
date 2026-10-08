import type { IExtensionApi } from "../../types/IExtensionContext";
import { removeFBLoadOrderProfile } from "./actions/loadOrder";

// Drop the load orders of every profile present before a profiles change and gone after it.
export function dropRemovedProfileLoadOrders(
  api: IExtensionApi,
  previous: Record<string, unknown> | undefined,
  current: Record<string, unknown> | undefined,
): void {
  for (const profileId of Object.keys(previous ?? {})) {
    if (current?.[profileId] === undefined) {
      api.store.dispatch(removeFBLoadOrderProfile(profileId));
    }
  }
}

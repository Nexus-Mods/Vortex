import type { IExtensionApi } from "../../../types/IExtensionContext";
import { updatePluginOrder } from "../actions/loadOrder";
import type { IStateWithGamebryo } from "../types/IStateWithGamebryo";

/** Names go through as given (the reducer keys by plugin id); setEnabled undefined enables all. */
export function handleSetPluginList(
  api: IExtensionApi,
  newPlugins: string[],
  setEnabled: boolean | undefined,
): void {
  const state = api.getState<IStateWithGamebryo>();
  api.store.dispatch(
    updatePluginOrder(
      newPlugins,
      setEnabled !== false,
      state.settings.plugins?.autoEnable ?? false,
    ),
  );
}

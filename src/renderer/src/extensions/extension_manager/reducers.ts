import { actionsToReducerSpec } from "@/reducers/builder";
import type { IAvailableExtension } from "@/types/extensions";
import type { IExtensionOptional } from "@/types/IState";

import * as actions from "./actions";

type DefaultState = {
  /** All remotely available extensions that can be downloaded. */
  available: IAvailableExtension[];
  /** Update time of the extension manifest. */
  updateTime: number;
  /** Map containing all recorded optional dependencies of an extension, key is the extension name. */
  optional: Record<string, IExtensionOptional[]>;
  /** Whether the extensions page lists bundled extensions. Session-only by design. */
  showBundled: boolean;
};

declare module "@/types/IState" {
  interface ISessionState {
    extensions: DefaultState;
  }
}

const defaultState: DefaultState = {
  available: [],
  optional: {},
  updateTime: 0,
  showBundled: false,
};

const sessionReducer = actionsToReducerSpec(defaultState, actions, {
  setAvailableExtensions: (state, payload) => ({ ...state, available: payload }),
  setOptionalExtensions: (state, payload) => ({ ...state, optional: payload }),
  setExtensionsUpdate: (state, payload) => ({ ...state, updateTime: payload }),
  setShowBundledExtensions: (state, payload) => ({ ...state, showBundled: payload }),
});

export default sessionReducer;

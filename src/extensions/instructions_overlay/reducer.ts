import type { IReducerSpec } from "../../renderer/types/IExtensionContext";
import { addReducer } from "../../renderer/types/IExtensionContext";
import type { IOverlaysState } from "../../renderer/types/IState";
import { deleteOrNop, setSafe } from "../../util/storeHelper";
import * as actions from "./actions";

const sessionReducer: IReducerSpec<IOverlaysState> = {
  reducers: {
    ...addReducer(actions.showOverlay, (state, payload) =>
      setSafe(state, ["overlays", payload.id], {
        title: payload.title,
        content: payload.content,
        componentId: payload.componentId,
        position: payload.pos,
        options: payload.options,
      }),
    ),
    ...addReducer(actions.dismissOverlay, (state, payload) =>
      deleteOrNop(state, ["overlays", payload]),
    ),
  },
  defaults: {
    overlays: {},
  },
};

export default sessionReducer;

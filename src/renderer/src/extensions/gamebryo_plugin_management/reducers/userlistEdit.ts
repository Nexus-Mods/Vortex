import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/userlistEdit";
import type { IPluginDependencies } from "../types/IPlugins";

declare module "@/types/IState" {
  interface ISessionState {
    pluginDependencies: IPluginDependencies;
  }
}

const userlistReducer = actionsToReducerSpec<IPluginDependencies, typeof actions>(
  {
    connection: undefined,
    dialog: undefined,
    quickEdit: {
      plugin: undefined,
      mode: "after",
    },
    groupEditorOpen: false,
  },
  actions,
  {
    setSource: (state, payload) => {
      if (payload.pos !== undefined) {
        return { ...state, connection: { ...state.connection, source: payload } };
      } else if (payload.id === (state.connection?.source?.id ?? undefined)) {
        return { ...state, connection: { ...state.connection, source: undefined } };
      } else {
        return state;
      }
    },
    setTarget: (state, payload) => {
      if (
        payload.pos !== undefined &&
        (payload.id !== null ||
          state.connection === undefined ||
          state.connection.target === undefined ||
          state.connection.target.id === undefined ||
          state.connection.target.id === null)
      ) {
        return { ...state, connection: { ...state.connection, target: payload } };
      } else if (payload.id === (state.connection?.target?.id ?? undefined)) {
        return { ...state, connection: { ...state.connection, target: undefined } };
      } else {
        return state;
      }
    },
    setCreateRule: (state, payload) => ({ ...state, dialog: payload }),
    closeDialog: (state) => ({ ...state, dialog: undefined }),
    setQuickEdit: (state, payload) => ({
      ...state,
      quickEdit: {
        plugin: payload.pluginId,
        mode: payload.mode,
      },
    }),
    openGroupEditor: (state, payload) => ({ ...state, groupEditorOpen: payload }),
  },
);

export default userlistReducer;

import { useSelector } from "react-redux";

import type { DevSetting } from "@/actions/devTools";
import type { IDevToolsState } from "@/reducers/devTools";
import type { IState } from "@/types/IState";

const devTools = (state: IState): IDevToolsState | undefined => state.session.devTools;

/** A dev-only switch from the dev tools menu. Always false outside development. */
export const useDevSetting = (name: DevSetting): boolean =>
  useSelector(
    (state: IState) => process.env.NODE_ENV === "development" && devTools(state)?.[name] === true,
  );

import type { IState } from "../../../types/IState";

/**
 * The application state with the gamebryo plugin management slices. Each reducer declares the
 * slice it owns on IState itself, so this is IState; kept for the code that names it.
 */
export type IStateWithGamebryo = IState;

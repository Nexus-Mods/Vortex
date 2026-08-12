import { createContext, useContext } from "react";

/** Layout facts a `Toolbar` publishes to the groups rendered inside it. */
export interface IToolbarContext {
  /** The toolbar row, or `null` for a group rendered without a `Toolbar`. */
  element: HTMLElement | null;
  /**
   * Where this toolbar's pinning is stored, or `null` for a toolbar that doesn't
   * offer it — which is every toolbar that hasn't asked. See `useToolbarPinning`.
   */
  pinningId: string | null;
  /**
   * Content width of the row, or `null` while it can't be measured — no
   * `ResizeObserver`, or the toolbar is hidden. Groups read `null` as "no width
   * constraint" and fall back to their slot cap alone.
   */
  width: number | null;
  /**
   * Changes whenever the row or any of its children changes size. A group's
   * budget depends on the controls ahead of it, so it has to re-fit when an
   * earlier group collapses and frees space.
   */
  signature: string;
}

export const ToolbarContext = createContext<IToolbarContext>({
  element: null,
  pinningId: null,
  width: null,
  signature: "",
});
export const useToolbarContext = (): IToolbarContext => useContext(ToolbarContext);

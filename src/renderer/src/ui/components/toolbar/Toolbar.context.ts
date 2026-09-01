import { createContext, useContext } from "react";

/**
 * What identifies a toolbar action to whoever is counting its clicks, independent of the
 * label on screen. Labels are translated, so nothing may derive identity from one.
 */
export interface IToolbarActionIdentity {
  /** Stable id — a test id, or the untranslated title an extension registered under. */
  id: string;
  /** Namespace of the extension that registered the action, absent for a page's own. */
  extension?: string;
}

/** Where in a toolbar an action was reached from. */
export type ToolbarSurface = "bar" | "overflow" | "menu";

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
  /**
   * Called when an action in this toolbar is clicked, for a page that opts into click
   * tracking. Absent on a toolbar nobody is counting, which leaves its controls
   * untouched. Identity is passed through rather than read, so nothing here needs to
   * know what becomes of it — see `useToolbarAnalytics` for the mods page's.
   */
  onActionClick?: (action: IToolbarActionIdentity, surface: ToolbarSurface) => void;
}

export const ToolbarContext = createContext<IToolbarContext>({
  element: null,
  pinningId: null,
  width: null,
  signature: "",
});
export const useToolbarContext = (): IToolbarContext => useContext(ToolbarContext);

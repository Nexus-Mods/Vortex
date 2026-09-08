import { createContext, useContext } from "react";

import type { IToolbarAction } from "./ToolbarGroup";

/**
 * What identifies a toolbar action to whoever is counting what happens to it,
 * independent of the label on screen. Labels are translated, so nothing may derive
 * identity from one.
 */
export interface IToolbarActionIdentity {
  /** The same stable id a decision to pin the action is stored against. */
  id: string;
  /** Namespace of the extension that registered the action, absent for a page's own. */
  extension?: string;
}

/**
 * What an action calls itself when its clicks and pins are counted: the `id` that
 * pinning already requires to survive a change of language or release.
 *
 * An action without one says nothing about itself, so what happens to it goes
 * unrecorded rather than recorded wrongly. It cannot be pinned either, and
 * `useToolbarPinning` says so.
 *
 * Lives here rather than beside either caller so that clicks and pins can never come
 * to disagree about what a button is called.
 */
export const identityOf = (action: IToolbarAction): IToolbarActionIdentity | undefined =>
  action.id ? { id: action.id, extension: action.extension } : undefined;

/** Where in a toolbar an action was reached from. */
export type ToolbarSurface = "bar" | "overflow" | "menu";

/**
 * What a page hands a toolbar to have its use counted. Identity is passed through
 * rather than read, so nothing under `ui/` needs to know what becomes of it.
 */
export interface IToolbarAnalytics {
  /** An action was clicked, and where in the toolbar it was reached from. */
  onActionClick: (action: IToolbarActionIdentity, surface: ToolbarSurface) => void;
  /**
   * The user pinned or unpinned an action, with `pinned` the state being moved *to*.
   * Only ever fires on a toolbar that offers pinning.
   */
  onPinChange: (action: IToolbarActionIdentity, pinned: boolean) => void;
  /** The user put every pin on this toolbar back to its default. */
  onPinsReset: () => void;
}

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
   * How what happens to this toolbar is counted, or absent on one nobody is counting —
   * which leaves its controls untouched. See `useToolbarAnalytics`.
   */
  tracking?: IToolbarAnalytics;
}

export const ToolbarContext = createContext<IToolbarContext>({
  element: null,
  pinningId: null,
  width: null,
  signature: "",
});
export const useToolbarContext = (): IToolbarContext => useContext(ToolbarContext);

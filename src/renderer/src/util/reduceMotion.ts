import { useSyncExternalStore } from "react";
import { useSelector } from "react-redux";

import type { IState } from "../types/IState";

const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** The attribute `<html>` carries while motion is turned down. */
export const REDUCE_MOTION_ATTRIBUTE = "reduceMotion";

const query = (): MediaQueryList | undefined =>
  typeof window === "undefined" || typeof window.matchMedia !== "function"
    ? undefined
    : window.matchMedia(REDUCE_MOTION_QUERY);

const subscribeToOs = (onChange: () => void): (() => void) => {
  const list = query();
  if (list === undefined) {
    return () => undefined;
  }

  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
};

const osPrefersReduce = (): boolean => query()?.matches ?? false;

/** The user's explicit choice, or undefined while they haven't made one. */
const selectOverride = (state: IState): boolean | undefined =>
  state.settings.interface.reduceMotion;

/**
 * Whether the operating system asks for reduced motion. Follows the preference live,
 * without a restart; false where the platform doesn't report one.
 */
export const useOsReduceMotion = (): boolean =>
  useSyncExternalStore(subscribeToOs, osPrefersReduce);

/**
 * Whether non-essential animation should be turned down: the user's own choice, or the
 * operating system's preference until they make one.
 *
 * Drives the `data-reduce-motion` attribute on `<html>`, which is what the stylesheets
 * key off; read this in components that decide about motion in JavaScript, and
 * {@link isReduceMotionActive} outside of React.
 */
export const useReduceMotion = (): boolean => {
  const override = useSelector(selectOverride);
  const os = useOsReduceMotion();

  return override ?? os;
};

/**
 * {@link useReduceMotion} for code that can't hold a hook. Reads the attribute the app
 * stamps on `<html>` rather than the store, so both answers come from one place.
 */
export const isReduceMotionActive = (): boolean =>
  typeof document !== "undefined" &&
  document.documentElement.dataset[REDUCE_MOTION_ATTRIBUTE] === "true";

/**
 * Publish the current answer to the stylesheets. Called at startup and whenever the
 * preference changes; the attribute is removed rather than set to "false" so the CSS only
 * needs the one selector.
 */
export const applyReduceMotion = (reduce: boolean): void => {
  if (typeof document === "undefined") {
    return;
  }

  if (reduce) {
    document.documentElement.dataset[REDUCE_MOTION_ATTRIBUTE] = "true";
  } else {
    delete document.documentElement.dataset[REDUCE_MOTION_ATTRIBUTE];
  }
};

/**
 * The effective preference from a state snapshot, for the startup path that runs before
 * React mounts.
 */
export const reduceMotionFromState = (state: IState): boolean =>
  selectOverride(state) ?? osPrefersReduce();

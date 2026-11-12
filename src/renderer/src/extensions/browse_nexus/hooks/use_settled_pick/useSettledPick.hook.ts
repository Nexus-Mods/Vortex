import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface IPending<T> {
  /** The pick waiting to be shown. */
  value: T;
  /** Told once it's shown. */
  onShown?: (value: T) => void;
  /** Whether it has rested for the delay. */
  isDue: boolean;
}

/** How long, in ms, a pick rests after its key's let go before it's shown. */
export const SETTLE_MS = 150;

/** How long, in ms, it rests instead when the key before it was let go soon before. */
export const TAPPING_SETTLE_MS = 400;

/** How soon, in ms, one key's let go after another for it to count as tapping through. */
export const TAPPING_WITHIN_MS = 500;

/**
 * A pick that waits for the keys to settle before it's shown, so holding or tapping a key through
 * a list shows only where it stops. `latestPick` follows every pick at once, and `settledPick`
 * follows `pickOnceSettled` once its key's let go and it has rested since for `SETTLE_MS`, or
 * `TAPPING_SETTLE_MS` while tapping, so a quick tap after it lands in time to take its place.
 * `pickNow` and `settleNow` show at once, `cancelPick` drops a pick before it's shown, and `startWith`
 * shows the first, safely while rendering.
 */
export const useSettledPick = <T>() => {
  const [latestPick, setLatestPick] = useState<T>();
  const [settledPick, setSettledPick] = useState<T>();
  const settledRef = useRef<T>();
  const pendingRef = useRef<IPending<T>>();
  const isHeldRef = useRef(false);
  const releasedAtRef = useRef(Number.NEGATIVE_INFINITY);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useLayoutEffect(() => {
    settledRef.current = settledPick;
  });

  const settle = (value: T, onShown?: (value: T) => void) => {
    if (value === settledRef.current) {
      return;
    }

    settledRef.current = value;
    setSettledPick(value);
    onShown?.(value);
  };

  /** Shows the pick waiting, once it's due and no key is held. */
  const settleIfDue = () => {
    const pending = pendingRef.current;

    if (!pending?.isDue || isHeldRef.current) {
      return;
    }

    pendingRef.current = undefined;
    settle(pending.value, pending.onShown);
  };

  const settleIfDueRef = useRef(settleIfDue);

  useEffect(() => {
    settleIfDueRef.current = settleIfDue;
  });

  useEffect(() => {
    const release = () => {
      const now = Date.now();
      const isTapping = now - releasedAtRef.current < TAPPING_WITHIN_MS;
      isHeldRef.current = false;
      releasedAtRef.current = now;

      if (pendingRef.current && !pendingRef.current.isDue) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(
          () => {
            if (pendingRef.current) {
              pendingRef.current.isDue = true;
            }
            settleIfDueRef.current();
          },
          isTapping ? TAPPING_SETTLE_MS : SETTLE_MS,
        );
      }
    };

    window.addEventListener("keyup", release, { capture: true });
    window.addEventListener("blur", release);

    return () => {
      window.removeEventListener("keyup", release, { capture: true });
      window.removeEventListener("blur", release);
      clearTimeout(timerRef.current);
    };
  }, []);

  /** Picks `value` now, from a key that's down, and shows it once the key's up and it's rested. */
  const pickOnceSettled = (value: T, onShown?: (value: T) => void) => {
    clearTimeout(timerRef.current);
    setLatestPick(value);
    isHeldRef.current = true;
    pendingRef.current = { value, onShown, isDue: false };
  };

  /** Picks and shows `value` at once, instead of one waiting to be shown. */
  const pickNow = (value: T, onShown?: (value: T) => void) => {
    clearTimeout(timerRef.current);
    pendingRef.current = undefined;
    setLatestPick(value);
    settle(value, onShown);
  };

  /** Shows the pick waiting, if any, at once, as if it had settled. */
  const settleNow = () => {
    const pending = pendingRef.current;

    if (pending) {
      pickNow(pending.value, pending.onShown);
    }
  };

  /** Drops the pick waiting, if any, going back to the one shown, which it never replaced. */
  const cancelPick = () => {
    if (!pendingRef.current) {
      return;
    }

    clearTimeout(timerRef.current);
    pendingRef.current = undefined;
    setLatestPick(settledRef.current);
  };

  /** Shows `value` from the start, before any pick; it only sets state, so is safe in render. */
  const startWith = (value: T) => {
    setLatestPick(value);
    setSettledPick(value);
  };

  return { latestPick, settledPick, pickOnceSettled, pickNow, settleNow, cancelPick, startWith };
};

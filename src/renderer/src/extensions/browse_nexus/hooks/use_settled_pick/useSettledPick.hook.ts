import { useEffect, useRef, useState } from "react";

interface IPending<T> {
  /** The pick waiting to be shown. */
  value: T;
  /** Told once it's shown. */
  onShown?: (value: T) => void;
  /** Whether it has rested for the delay. */
  isDue: boolean;
}

/** How long, in ms, a pick rests before it's shown. */
export const SETTLE_MS = 150;

/** How long, in ms, a pick rests instead when it comes soon after a key was let go. */
export const TAPPING_SETTLE_MS = 400;

/** How soon, in ms, after a key's let go a pick counts as tapping through. */
export const TAPPING_WITHIN_MS = 500;

/**
 * A pick from the keyboard that waits to be shown until the keys settle: `picked` follows every
 * pick at once, and `shown` follows `pick` once it has rested and the key's been let go, so a key
 * held down through a list shows only where it stops, whatever the system's repeat delay. A pick
 * rests for `SETTLE_MS`, or for `TAPPING_SETTLE_MS` when it comes within `TAPPING_WITHIN_MS` of a
 * key being let go, so tapping through the list shows only where the taps stop. A key-up is heard
 * before anything else can stop it, and a window that loses focus counts as letting go, as its
 * key-up never comes. `show` shows a pick straight away, and `flush` the one waiting. `onShown`
 * runs as a pick is shown, and not for picking back the one shown.
 */
export const useSettledPick = <T>() => {
  const [picked, setPicked] = useState<T>();
  const [shown, setShown] = useState<T>();
  const shownRef = useRef<T>();
  const pendingRef = useRef<IPending<T>>();
  const isHeldRef = useRef(false);
  const releasedAtRef = useRef(Number.NEGATIVE_INFINITY);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const display = (value: T, onShown?: (value: T) => void) => {
    if (value === shownRef.current) {
      return;
    }

    shownRef.current = value;
    setShown(value);
    onShown?.(value);
  };

  /** Shows the pick waiting, once it's due and no key is held. */
  const showIfSettled = () => {
    const pending = pendingRef.current;

    if (!pending?.isDue || isHeldRef.current) {
      return;
    }

    pendingRef.current = undefined;
    display(pending.value, pending.onShown);
  };

  const showIfSettledRef = useRef(showIfSettled);

  useEffect(() => {
    showIfSettledRef.current = showIfSettled;
  });

  useEffect(() => {
    const release = () => {
      isHeldRef.current = false;
      releasedAtRef.current = Date.now();
      showIfSettledRef.current();
    };

    window.addEventListener("keyup", release, { capture: true });
    window.addEventListener("blur", release);

    return () => {
      window.removeEventListener("keyup", release, { capture: true });
      window.removeEventListener("blur", release);
      clearTimeout(timerRef.current);
    };
  }, []);

  /** Picks `value` now, from a key that's down, and shows it once it's rested and the key's up. */
  const pick = (value: T, onShown?: (value: T) => void) => {
    const isTapping = Date.now() - releasedAtRef.current < TAPPING_WITHIN_MS;
    clearTimeout(timerRef.current);
    setPicked(value);
    isHeldRef.current = true;
    pendingRef.current = { value, onShown, isDue: false };
    timerRef.current = setTimeout(
      () => {
        if (pendingRef.current) {
          pendingRef.current.isDue = true;
        }
        showIfSettledRef.current();
      },
      isTapping ? TAPPING_SETTLE_MS : SETTLE_MS,
    );
  };

  /** Picks and shows `value` at once, instead of one waiting to be shown. */
  const show = (value: T, onShown?: (value: T) => void) => {
    clearTimeout(timerRef.current);
    pendingRef.current = undefined;
    setPicked(value);
    display(value, onShown);
  };

  /** Shows the pick waiting, if any, at once, as if it had settled. */
  const flush = () => {
    const pending = pendingRef.current;

    if (pending) {
      show(pending.value, pending.onShown);
    }
  };

  return { picked, shown, pick, show, flush };
};

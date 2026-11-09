import { useEffect, useRef, useState } from "react";

interface IPending<T> {
  /** The pick waiting to be shown. */
  value: T;
  /** Told once it's shown. */
  onShown?: (value: T) => void;
  /** Whether it has rested for the delay. */
  isDue: boolean;
}

interface ISettledPickOptions {
  /** How long, in ms, a pick rests before it's shown. */
  delayMs: number;
  /** How long, in ms, a pick rests instead when it comes soon after a key was let go. */
  tappingDelayMs: number;
  /** How soon, in ms, after a key's let go a pick counts as tapping through. */
  tappingWithinMs: number;
}

/**
 * A pick from the keyboard that waits to be shown until the keys settle: `picked` follows every
 * pick at once, and `shown` follows `pick` once it has rested and the key's been let go, so a key
 * held down through a list shows only where it stops, whatever the system's repeat delay. A pick
 * rests for `delayMs`, or for `tappingDelayMs` when it comes within `tappingWithinMs` of a key
 * being let go, so tapping through the list shows only where the taps stop. A window that loses
 * focus counts as letting go, as its key-up never comes. `show` shows a pick straight away.
 * `onShown` runs as a pick is shown, and not for picking back the one shown.
 */
export const useSettledPick = <T>({
  delayMs,
  tappingDelayMs,
  tappingWithinMs,
}: ISettledPickOptions) => {
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
  const flush = () => {
    const pending = pendingRef.current;

    if (!pending?.isDue || isHeldRef.current) {
      return;
    }

    pendingRef.current = undefined;
    display(pending.value, pending.onShown);
  };

  const flushRef = useRef(flush);

  useEffect(() => {
    flushRef.current = flush;
  });

  useEffect(() => {
    const release = () => {
      isHeldRef.current = false;
      releasedAtRef.current = Date.now();
      flushRef.current();
    };

    window.addEventListener("keyup", release);
    window.addEventListener("blur", release);

    return () => {
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", release);
      clearTimeout(timerRef.current);
    };
  }, []);

  /** Picks `value` now, from a key that's down, and shows it once it's rested and the key's up. */
  const pick = (value: T, onShown?: (value: T) => void) => {
    const isTapping = Date.now() - releasedAtRef.current < tappingWithinMs;
    clearTimeout(timerRef.current);
    setPicked(value);
    isHeldRef.current = true;
    pendingRef.current = { value, onShown, isDue: false };
    timerRef.current = setTimeout(
      () => {
        if (pendingRef.current) {
          pendingRef.current.isDue = true;
        }
        flushRef.current();
      },
      isTapping ? tappingDelayMs : delayMs,
    );
  };

  /** Picks and shows `value` at once, instead of one waiting to be shown. */
  const show = (value: T, onShown?: (value: T) => void) => {
    clearTimeout(timerRef.current);
    pendingRef.current = undefined;
    setPicked(value);
    display(value, onShown);
  };

  return { picked, shown, pick, show };
};

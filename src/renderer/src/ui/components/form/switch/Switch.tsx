import React, { useEffect, useRef, type InputHTMLAttributes } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/**
 * Switch — a tri-state switch: `off`, `on`, and `semi-on` (a "mixed" state set
 * programmatically, e.g. a master control whose children are partially on).
 * Clicking only ever flips between on and off; semi-on is never reached by user
 * interaction.
 *
 * Implementation: a visually-hidden native `<input type="checkbox">` drives the
 * state and accessibility. Setting `indeterminate` makes the browser report
 * `aria-checked="mixed"` — that is the `semi-on` state. The visible track/thumb
 * are styled spans whose appearance is keyed off `data-state` on the track.
 *
 * PORTING NOTE: once `@headlessui/react` is upgraded to v2 (after the React
 * upgrade), reimplement this on top of HeadlessUI's `<Switch>`. The `nxm-switch`
 * classes live on the track/thumb specifically so they can move straight onto
 * the Switch's elements. HeadlessUI's Switch is binary, so the tri-state must be
 * preserved here in the wrapper — keep driving `data-state` (and the native
 * `indeterminate`/`aria-checked="mixed"`) for the `semi-on` state.
 */
export type ISwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Renders the "semi-on" state and reports `aria-checked="mixed"`. */
  indeterminate?: boolean;
};

export const Switch = ({
  checked,
  className,
  disabled,
  indeterminate,
  ...inputProps
}: ISwitchProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // `indeterminate` is a DOM property, not an attribute, so it must be set
  // imperatively. This also drives the `:indeterminate` pseudo-class and makes
  // the accessibility tree report `aria-checked="mixed"`.
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = !!indeterminate;
    }
  }, [indeterminate]);

  return (
    <label
      className={joinClasses(["nxm-switch", className], {
        "nxm-switch-disabled": disabled,
      })}
      data-state={indeterminate ? "semi-on" : checked ? "on" : "off"}
    >
      <input
        checked={checked}
        className="nxm-switch-input"
        disabled={disabled}
        ref={inputRef}
        type="checkbox"
        {...inputProps}
      />

      <span className="nxm-switch-thumb" />
    </label>
  );
};

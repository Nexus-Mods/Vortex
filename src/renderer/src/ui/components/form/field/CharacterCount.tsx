import React, { type CSSProperties } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/**
 * Room a control keeps for its count, as wide as the count can get, on the control's wrapper; the
 * input only takes it while the count shows.
 */
export const characterCountRoom = (maxLength: number) =>
  ({ "--nxm-character-count-width": `${String(maxLength).length * 2 + 1.5}ch` }) as CSSProperties;

/**
 * Characters left out of `maxLength`, hidden until half are left, then turning to warning and then
 * danger as they run low. It sits over the control, so showing it moves nothing.
 * Deliberately not a `Description`, so it isn't read out every time the control takes focus.
 */
export const CharacterCount = ({ length, maxLength }: { length: number; maxLength: number }) => {
  const remaining = maxLength - length;

  return (
    <span
      aria-label="remaining character count"
      className={joinClasses(["nxm-field-character-count"], {
        "nxm-field-character-count-hidden": remaining > maxLength * 0.5,
        "nxm-field-character-count-danger": remaining <= maxLength * 0.1,
        "nxm-field-character-count-warning":
          remaining > maxLength * 0.1 && remaining <= maxLength * 0.25,
      })}
    >
      {`${remaining} / ${maxLength}`}
    </span>
  );
};

import React, { type CSSProperties } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/**
 * The style for a control's wrapper that keeps room for its count, as wide as the count can get:
 * two numbers of `maxLength`'s digits, and about 1.5ch for the " / " between them. The input only
 * takes the room while the count shows. None without a `maxLength`.
 */
export const characterCountStyle = (maxLength?: number): CSSProperties | undefined => {
  if (!maxLength) {
    return undefined;
  }

  return {
    "--nxm-character-count-width": `${String(maxLength).length * 2 + 1.5}ch`,
  } as CSSProperties;
};

/**
 * Characters left out of `maxLength`, hidden until half are left, then turning to warning and then
 * danger as they run low, and never below none for a value already over it. It sits over the
 * control, so showing it moves nothing.
 * Deliberately not a `Description`, so it isn't read out every time the control takes focus.
 */
export const CharacterCount = ({ length, maxLength }: { length: number; maxLength: number }) => {
  const remaining = Math.max(0, maxLength - length);

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

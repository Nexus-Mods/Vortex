import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/**
 * Characters left out of `maxLength`, turning to warning and then danger as they run low.
 * Deliberately not a `Description`, so it isn't read out every time the control takes focus.
 */
export const CharacterCount = ({ length, maxLength }: { length: number; maxLength: number }) => {
  const remaining = maxLength - length;

  return (
    <span
      aria-label="remaining character count"
      className={joinClasses(["nxm-field-character-count"], {
        "nxm-field-character-count-danger": remaining <= maxLength * 0.1,
        "nxm-field-character-count-warning":
          remaining > maxLength * 0.1 && remaining <= maxLength * 0.25,
      })}
    >
      {`${remaining} / ${maxLength}`}
    </span>
  );
};

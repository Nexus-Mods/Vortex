import React, { useCallback, useState } from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { ToolbarButton } from "@/ui/components/toolbar/ToolbarButton";
import { joinClasses } from "@/ui/utils/joinClasses";

export interface IEndorseButtonProps {
  /** Its tooltip and accessible name: the action, "Endorse", whichever state it's in. */
  label: string;
  /** Whether it's endorsed: the thumb filled, and the toggle pressed. */
  isEndorsed: boolean;
  /**
   * Whether a request the user made is under way: busy, and clicks do nothing. While it is,
   * `isEndorsed` is what was asked for, and becoming endorsed and pending, in either order, pops
   * the thumb with a burst; so set it only for the user's own request.
   */
  isPending?: boolean;
  /** Shows a spinner in place of the thumb and turns it off, for a request whose way isn't known. */
  isLoading?: boolean;
  /** Turns it off but keeps it hoverable; this is its tooltip and description. */
  disabledReason?: string;
  /** Endorses or withdraws; not called while pending. */
  onClick?: () => void;
}

/** One spark every 45 degrees, each turned to fly out along its angle. */
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** The ring and sparks that burst out of the thumb as it's endorsed. */
const EndorseBurst = () => (
  <span aria-hidden={true} className="nxm-endorse-burst" data-testid="endorse-burst">
    <span className="nxm-endorse-burst-ring" />

    {SPARK_ANGLES.map((angle) => (
      <span className="nxm-endorse-burst-spark" key={angle} style={{ rotate: `${angle}deg` }} />
    ))}
  </span>
);

/**
 * An endorsement as a thumb toggle, filled once endorsed.
 *
 * Becoming endorsed and pending, in either order, which only the user's own request causes, pops
 * the thumb with a burst until the pop ends or is cancelled, such as by the page being hidden, or
 * the thumb empties. A thumb drawn endorsed, or filled by a refresh, doesn't celebrate. React 18 has no `onAnimationCancel`,
 * so the thumb's box listens for the event itself.
 */
export const EndorseButton = ({
  disabledReason,
  isEndorsed,
  isLoading = false,
  isPending = false,
  label,
  onClick,
}: IEndorseButtonProps) => {
  const isAskedToEndorse = isEndorsed && isPending;
  const [wasAskedToEndorse, setWasAskedToEndorse] = useState(isAskedToEndorse);
  const [isCelebrating, setIsCelebrating] = useState(false);
  if (isAskedToEndorse !== wasAskedToEndorse) {
    setWasAskedToEndorse(isAskedToEndorse);
    if (isAskedToEndorse) {
      setIsCelebrating(true);
    }
  }
  if (isCelebrating && !isEndorsed) {
    setIsCelebrating(false);
  }

  const stopOnCancel = useCallback((box: HTMLSpanElement | null) => {
    box?.addEventListener("animationcancel", () => setIsCelebrating(false));
  }, []);

  return (
    <ToolbarButton
      appearance="weak"
      aria-busy={isPending || undefined}
      aria-pressed={isEndorsed}
      brand={isEndorsed ? "primary" : "neutral"}
      data-testid="endorse-button"
      disabledReason={disabledReason}
      isLoading={isLoading}
      label={label}
      leftIcon={
        <span className="nxm-endorse" ref={stopOnCancel}>
          {isCelebrating && <EndorseBurst />}

          <Icon
            className={joinClasses(["nxm-endorse-thumb"], {
              "nxm-endorse-thumb-pop": isCelebrating,
            })}
            data-testid="endorse-thumb"
            filled={isEndorsed}
            name="thumb_up"
            size="none"
            onAnimationEnd={() => setIsCelebrating(false)}
          />
        </span>
      }
      size="sm"
      onClick={isPending ? undefined : onClick}
    />
  );
};

import type { TFunction } from "i18next";
import React, { useState } from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { ToolbarButton } from "@/ui/components/toolbar/ToolbarButton";
import { joinClasses } from "@/ui/utils/joinClasses";

export interface IEndorseModButtonProps {
  gameId: string;
  modId: string;
  /** Nexus's answer, such as "Undecided", "Endorsed" or "Disabled"; "pending" while it's asked. */
  endorsedStatus: string;
  t: TFunction;
  onEndorseMod: (gameId: string, modId: string, endorsedStatus: string) => void;
}

/** One spark every 45 degrees, each turned to fly out along its angle. */
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** The ring and sparks that burst out of the thumb as a mod is endorsed. */
const EndorseBurst = () => (
  <span aria-hidden={true} className="nxm-endorse-burst" data-testid="endorse-burst">
    <span className="nxm-endorse-burst-ring" />

    {SPARK_ANGLES.map((angle) => (
      <span className="nxm-endorse-burst-spark" key={angle} style={{ rotate: `${angle}deg` }} />
    ))}
  </span>
);

/**
 * A mod's endorsement as a thumb, filled once endorsed, that endorses the mod or withdraws it.
 * Becoming endorsed pops the thumb with a burst. While Nexus is asked, it shows what was asked
 * for, the opposite of its last answer.
 */
export const EndorseModButton = ({
  endorsedStatus,
  gameId,
  modId,
  t,
  onEndorseMod,
}: IEndorseModButtonProps) => {
  const status = endorsedStatus.toLowerCase();
  const isPending = status === "pending";

  // Nexus's last answer; "pending" if it was being asked before this was drawn.
  const [answer, setAnswer] = useState(status);
  if (!isPending && status !== answer) {
    setAnswer(status);
  }

  const isEndorsed = isPending ? answer !== "endorsed" : status === "endorsed";

  // Only a change while it's drawn celebrates, not a mod endorsed before it's shown.
  const [wasEndorsed, setWasEndorsed] = useState(isEndorsed);
  const [isCelebrating, setIsCelebrating] = useState(false);
  if (isEndorsed !== wasEndorsed) {
    setWasEndorsed(isEndorsed);
    setIsCelebrating(isEndorsed);
  }

  const disabledReason = {
    disabled: t("Endorsement disabled by author"),
    blocked: t("You have been blocked by the curator."),
  }[status];

  return (
    <div className="flex justify-center">
      <ToolbarButton
        appearance="weak"
        brand={isEndorsed ? "primary" : "neutral"}
        data-testid="endorse-button"
        disabledReason={disabledReason}
        isLoading={isPending && answer === "pending"}
        label={isEndorsed ? t("Endorsed") : t("Endorse")}
        leftIcon={
          <span className="nxm-endorse">
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
        onClick={() => {
          if (!isPending) {
            onEndorseMod(gameId, modId, endorsedStatus);
          }
        }}
      />
    </div>
  );
};

import type { VortexGameId } from "@vortex/shared";
import type { TFunction } from "i18next";
import React, { useState } from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { ToolbarButton } from "@/ui/components/toolbar/ToolbarButton";
import { joinClasses } from "@/ui/utils/joinClasses";

export interface IEndorseModButtonProps {
  gameId: VortexGameId;
  modId: string;
  /** Nexus's answer, such as "Undecided", "Endorsed" or "Disabled"; "pending" while it's asked. */
  endorsedStatus: string;
  t: TFunction;
  /** Asks Nexus to endorse or withdraw. Without one, as for a collection, it only shows the answer. */
  onEndorseMod?: (gameId: VortexGameId, modId: string, endorsedStatus: string) => void;
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
 * Endorsing it here pops the thumb with a burst. While Nexus is asked, it shows what was asked
 * for, the opposite of its last answer, and ignores clicks.
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

  // Nexus's last answer; "pending" if it was being asked before this was drawn, which leaves
  // unknown which way it was asked.
  const [answer, setAnswer] = useState(status);
  if (!isPending && status !== answer) {
    setAnswer(status);
  }

  const isAnswerKnown = answer !== "pending";
  const isEndorsed = isPending ? isAnswerKnown && answer !== "endorsed" : status === "endorsed";

  // Set by a click that endorses, so a refresh from Nexus fills the thumb without celebrating.
  const [isEndorseClicked, setIsEndorseClicked] = useState(false);
  const [wasEndorsed, setWasEndorsed] = useState(isEndorsed);
  const [isCelebrating, setIsCelebrating] = useState(false);
  if (isEndorsed !== wasEndorsed) {
    setWasEndorsed(isEndorsed);
    setIsCelebrating(isEndorsed && isEndorseClicked);
    setIsEndorseClicked(false);
  }

  const disabledReason =
    {
      disabled: t("Endorsement disabled by author"),
      blocked: t("You have been blocked by the curator."),
    }[status] ?? (onEndorseMod ? undefined : t("Endorse a collection from its page"));

  return (
    <div className="flex justify-center">
      <ToolbarButton
        appearance="weak"
        aria-busy={isPending || undefined}
        aria-pressed={isEndorsed}
        brand={isEndorsed ? "primary" : "neutral"}
        data-testid="endorse-button"
        disabledReason={disabledReason}
        isLoading={isPending && !isAnswerKnown}
        label={t("Endorse")}
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
            setIsEndorseClicked(!isEndorsed);
            onEndorseMod?.(gameId, modId, endorsedStatus);
          }
        }}
      />
    </div>
  );
};

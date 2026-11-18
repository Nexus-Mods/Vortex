import type { VortexGameId } from "@vortex/shared";
import type { TFunction } from "i18next";
import React, { useState } from "react";

import { EndorseButton } from "@/ui/components/endorse_button/EndorseButton";

export interface IEndorseModButtonProps {
  gameId: VortexGameId;
  modId: string;
  /** Nexus's answer, such as "Undecided", "Endorsed" or "Disabled"; "pending" while it's asked. */
  endorsedStatus: string;
  t: TFunction;
  /** Asks Nexus to endorse or withdraw. Without one, as for a collection, it only shows the answer. */
  onEndorseMod?: (gameId: VortexGameId, modId: string, endorsedStatus: string) => void;
}

/**
 * A mod's endorsement on Nexus, as an `EndorseButton` centred in its table cell.
 *
 * The store overwrites Nexus's answer with "pending" while it's asked, so this keeps the last
 * answer and, while pending, shows what was asked for: the opposite of it. Drawn while already
 * pending, it can't know which way it was asked, and shows a spinner. "Disabled" and "Blocked"
 * can't be pressed and give their reason.
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

  const [answer, setAnswer] = useState(status);
  if (!isPending && status !== answer) {
    setAnswer(status);
  }
  const isAnswerKnown = answer !== "pending";

  const disabledReason =
    {
      disabled: t("Endorsement disabled by author"),
      blocked: t("You have been blocked by the curator."),
    }[status] ?? (onEndorseMod ? undefined : t("Endorse a collection from its page"));

  return (
    <div className="flex justify-center">
      <EndorseButton
        disabledReason={disabledReason}
        isEndorsed={isPending ? isAnswerKnown && answer !== "endorsed" : status === "endorsed"}
        isLoading={isPending && !isAnswerKnown}
        isPending={isPending}
        label={t("Endorse")}
        onClick={() => onEndorseMod?.(gameId, modId, endorsedStatus)}
      />
    </div>
  );
};

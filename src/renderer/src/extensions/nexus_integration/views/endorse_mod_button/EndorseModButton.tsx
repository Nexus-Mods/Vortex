import type { VortexGameId } from "@vortex/shared";
import type { TFunction } from "i18next";
import React, { useState } from "react";
import { useSelector } from "react-redux";

import { EndorseButton } from "@/ui/components/endorse_button/EndorseButton";

import { isLoggedIn } from "../../selectors";

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
 * can't be pressed and give their reason, and neither can it while logged out, as Nexus would
 * turn the request down. It reads the login itself, as a table cell isn't drawn again on login.
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
  const isUserLoggedIn = useSelector(isLoggedIn);

  const disabledReason =
    {
      disabled: t("Endorsement disabled by author"),
      blocked: t("You have been blocked by the curator."),
    }[status] ??
    (onEndorseMod ? undefined : t("Endorse a collection from its page")) ??
    (isUserLoggedIn ? undefined : t("Log in to endorse"));

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

/**
 * Endorse Button Demo
 * The Mods table's endorse button, against a pretend Nexus, so trying it endorses nothing.
 */

import { VortexGameId } from "@vortex/shared";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Typography } from "@/ui/components/typography/Typography";

import { EndorseModButton } from "./EndorseModButton";

/** A game id for the pretend Nexus; nothing is asked of a real game. */
const DEMO_GAME_ID = VortexGameId("demo");

/** How long the pretend Nexus takes to answer, about as long as the real one. */
const ANSWER_DELAY = 800;

interface ISimulatedEndorseProps {
  /** What it's called below its button. */
  label: string;
  /** Whether Nexus is asked with a pending step first, as the Mods table does. */
  hasPendingStep?: boolean;
  /** Whether Nexus turns every endorsement down, as on an error. */
  isRefused?: boolean;
}

/** An endorse button whose pretend Nexus answers after a moment. */
const SimulatedEndorse = ({
  label,
  hasPendingStep = true,
  isRefused = false,
}: ISimulatedEndorseProps) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState("Undecided");

  const onEndorseMod = (_gameId: VortexGameId, _modId: string, current: string) => {
    const answer = current.toLowerCase() === "endorsed" ? "Abstained" : "Endorsed";
    if (hasPendingStep) {
      setStatus("pending");
    }
    setTimeout(() => setStatus(isRefused ? "Undecided" : answer), ANSWER_DELAY);
  };

  return (
    <div className="flex w-40 flex-col items-center gap-2">
      <EndorseModButton
        endorsedStatus={status}
        gameId={DEMO_GAME_ID}
        modId={label}
        t={t}
        onEndorseMod={onEndorseMod}
      />

      <Typography appearance="subdued" className="text-center" typographyType="body-sm">
        {label}
      </Typography>
    </div>
  );
};

/** States it can be drawn in, without a click. */
const STATES = ["Undecided", "Abstained", "Endorsed", "Disabled", "Blocked", "pending"];

export const EndorseModButtonDemo = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          Endorse button
        </Typography>

        <Typography appearance="subdued">
          The Mods table's and Extensions page's endorse button. These answer from a pretend Nexus,
          so nothing is endorsed. Turn on Settings → Interface → Reduce motion to see it without the
          animation.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Try it
        </Typography>

        <div className="flex flex-wrap gap-6">
          <SimulatedEndorse label="Nexus agrees" />

          <SimulatedEndorse hasPendingStep={false} label="No pending step (Extensions)" />

          <SimulatedEndorse isRefused={true} label="Nexus refuses" />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          States
        </Typography>

        <div className="flex flex-wrap gap-6">
          {STATES.map((status) => (
            <div className="flex w-24 flex-col items-center gap-2" key={status}>
              <EndorseModButton
                endorsedStatus={status}
                gameId={DEMO_GAME_ID}
                modId={status}
                t={t}
                onEndorseMod={() => undefined}
              />

              <Typography appearance="subdued" typographyType="body-sm">
                {status}
              </Typography>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

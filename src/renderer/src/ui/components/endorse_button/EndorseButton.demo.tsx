/**
 * Endorse Button Demo
 * The endorse thumb, against a pretend Nexus, so trying it endorses nothing.
 */

import React, { useEffect, useRef, useState } from "react";

import { Typography } from "@/ui/components/typography/Typography";

import { EndorseButton, type IEndorseButtonProps } from "./EndorseButton";

/** How long the pretend Nexus takes to answer, about as long as the real one. */
const ANSWER_DELAY = 800;

interface ISimulatedEndorseProps {
  /** What it's called below its button. */
  label: string;
  /** Whether Nexus turns every request down, as on an error. */
  isRefused?: boolean;
}

/** An endorse button that shows what was asked at once, then the pretend Nexus's answer. */
const SimulatedEndorse = ({ label, isRefused = false }: ISimulatedEndorseProps) => {
  const [isEndorsed, setIsEndorsed] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const answerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(answerTimer.current), []);

  const onClick = () => {
    const isAsked = !isEndorsed;
    setIsEndorsed(isAsked);
    setIsPending(true);
    answerTimer.current = setTimeout(() => {
      setIsEndorsed(isRefused ? !isAsked : isAsked);
      setIsPending(false);
    }, ANSWER_DELAY);
  };

  return (
    <div className="flex w-40 flex-col items-center gap-2">
      <EndorseButton
        isEndorsed={isEndorsed}
        isPending={isPending}
        label="Endorse"
        onClick={onClick}
      />

      <Typography appearance="subdued" className="text-center" typographyType="body-sm">
        {label}
      </Typography>
    </div>
  );
};

/** States it can be drawn in, without a click. */
const STATES: { name: string; props: Omit<IEndorseButtonProps, "label"> }[] = [
  { name: "Not endorsed", props: { isEndorsed: false } },
  { name: "Endorsed", props: { isEndorsed: true } },
  { name: "Pending", props: { isEndorsed: true, isPending: true } },
  { name: "Loading", props: { isEndorsed: false, isLoading: true } },
  {
    name: "Disabled",
    props: { isEndorsed: false, disabledReason: "Endorsement disabled by author" },
  },
];

export const EndorseButtonDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Endorse button
      </Typography>

      <Typography appearance="subdued">
        The endorse thumb, as the Mods table and Extensions page draw it. These answer from a
        pretend Nexus, so nothing is endorsed. Turn on Settings → Interface → Reduce motion to see
        it without the animation.
      </Typography>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Try it
      </Typography>

      <div className="flex flex-wrap gap-6">
        <SimulatedEndorse label="Nexus agrees" />

        <SimulatedEndorse isRefused={true} label="Nexus refuses" />
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        States
      </Typography>

      <div className="flex flex-wrap gap-6">
        {STATES.map(({ name, props }) => (
          <div className="flex w-24 flex-col items-center gap-2" key={name}>
            <EndorseButton label="Endorse" onClick={() => undefined} {...props} />

            <Typography appearance="subdued" typographyType="body-sm">
              {name}
            </Typography>
          </div>
        ))}
      </div>
    </div>
  </div>
);

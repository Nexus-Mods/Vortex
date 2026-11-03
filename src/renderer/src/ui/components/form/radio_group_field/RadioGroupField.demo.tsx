/** Demonstrates RadioGroupField: one option chosen at a time, each with a label and optional hint. */

import React, { useState } from "react";

import { FormDemoSection as Section } from "@/ui/components/form/FormDemoSection";
import { Typography } from "@/ui/components/typography/Typography";

import { RadioGroupField, type IRadioOption } from "./RadioGroupField";

const OPTIONS: IRadioOption[] = [
  { value: "replace", label: "Replace the existing mod", hint: "Updates every profile." },
  {
    value: "alongside",
    label: "Install alongside",
    hint: "Both versions stay available. Only the active profile is updated.",
  },
  { value: "skip", label: "Skip this mod" },
];

export const RadioGroupFieldDemo = () => {
  const [chosen, setChosen] = useState<string | undefined>("replace");
  const [unchosen, setUnchosen] = useState<string | undefined>(undefined);

  return (
    <div className="space-y-10">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h3" typographyType="heading-xs">
          Radio group field
        </Typography>

        <Typography appearance="subdued">
          A group of options, one chosen at a time, each with its label and an optional hint.
          Clicking a label chooses its option and the arrow keys move between them. The label prop
          names the group for screen readers and isn&apos;t shown.
        </Typography>
      </div>

      <Section description="One option chosen, with hints." title="Chosen">
        <RadioGroupField
          label="Update mode"
          options={OPTIONS}
          value={chosen}
          onChange={setChosen}
        />
      </Section>

      <Section description="Nothing is chosen until the user picks one." title="Nothing chosen">
        <RadioGroupField
          label="Update mode"
          options={OPTIONS}
          value={unchosen}
          onChange={setUnchosen}
        />
      </Section>

      <Section description="A disabled option can't be chosen." title="Disabled option">
        <RadioGroupField
          label="Update mode"
          options={[...OPTIONS.slice(0, 2), { ...OPTIONS[2], disabled: true }]}
          value="alongside"
          onChange={() => undefined}
        />
      </Section>
    </div>
  );
};

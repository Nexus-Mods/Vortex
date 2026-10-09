/** Demonstrates SwitchField, and the Field parts and bare Switch it's built from. */

import React, { useState } from "react";

import { Description } from "@/ui/components/form/field/Description";
import { Field } from "@/ui/components/form/field/Field";
import { Label } from "@/ui/components/form/field/Label";
import { FormDemoSection as Section } from "@/ui/components/form/FormDemoSection";
import { Switch } from "@/ui/components/form/switch/Switch";
import { Typography } from "@/ui/components/typography/Typography";

import { SwitchField } from "./SwitchField";

const CHILD_LABELS = ["Auto-update", "Notifications", "Telemetry"];

/** How long the demo's change takes to land, standing in for whatever the switch waits on. */
const SAVE_MS = 1500;

export const SwitchFieldDemo = () => {
  const [enabled, setEnabled] = useState(true);
  const [children, setChildren] = useState<boolean[]>([true, false, false]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState<boolean>();

  // Shows the change at once, loading, until it lands.
  const save = (checked: boolean) => {
    setSaving(checked);
    setTimeout(() => {
      setSaved(checked);
      setSaving(undefined);
    }, SAVE_MS);
  };

  const allOn = children.every(Boolean);
  const noneOn = !children.some(Boolean);

  const setChild = (index: number, value: boolean) =>
    setChildren((current) => current.map((on, i) => (i === index ? value : on)));

  return (
    <div className="space-y-10">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h3" typographyType="heading-xs">
          Switch field
        </Typography>

        <Typography appearance="subdued">
          A tri-state switch with its label beside it: off, on, and a semi-on set by the consumer
          (read out as aria-checked=&quot;mixed&quot;). Clicking the switch or its label only flips
          between on and off.
        </Typography>
      </div>

      <Section description="Off, on and semi-on, enabled and then disabled." title="States">
        <SwitchField checked={false} label="Off" onChange={() => undefined} />

        <SwitchField checked label="On" onChange={() => undefined} />

        <SwitchField indeterminate label="Semi-on" onChange={() => undefined} />

        <SwitchField disabled checked={false} label="Off, disabled" />

        <SwitchField checked disabled label="On, disabled" />

        <SwitchField disabled indeterminate label="Semi-on, disabled" />
      </Section>

      <Section
        description="A change under way: the thumb pulses, it reads out as busy, and clicks wait until it's done. The last one shows its change at once and takes a moment to land, as a mod's switch does."
        title="Loading"
      >
        <SwitchField isLoading checked={false} label="Off, loading" onChange={() => undefined} />

        <SwitchField checked isLoading label="On, loading" onChange={() => undefined} />

        <SwitchField
          checked={saving ?? saved}
          isLoading={saving !== undefined}
          label="Click to save"
          onChange={save}
        />
      </Section>

      <Section
        description="Hints run full width under the switch and label, and are read out after the label."
        title="Hints and hidden label"
      >
        <SwitchField
          checked={enabled}
          hints="Checks for updates when Vortex starts"
          label="One hint"
          onChange={setEnabled}
        />

        <SwitchField
          defaultChecked
          hints={["Checks for updates when Vortex starts", "Never installs without asking"]}
          label="Several hints"
        />

        <SwitchField hideLabel label="Hidden label" />
      </Section>

      <Section
        description="The master switch is semi-on when some, but not all, of its children are on. Clicking it turns everything on, or off when already fully on."
        title="Semi-on from children"
      >
        <div className="col-span-2 space-y-3">
          <SwitchField
            checked={allOn}
            indeterminate={!allOn && !noneOn}
            label="All settings"
            onChange={(checked) => setChildren(children.map(() => checked))}
          />

          <div className="ml-11 space-y-3">
            {CHILD_LABELS.map((childLabel, index) => (
              <SwitchField
                checked={children[index]}
                key={childLabel}
                label={childLabel}
                onChange={(checked) => setChild(index, checked)}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section
        description="SwitchField is Field, Switch, Label and Description put together. Compose them directly for a layout it doesn't cover; Field links the label and descriptions to the switch itself."
        title="Building blocks"
      >
        <Field className="nxm-switch-field">
          <div className="nxm-field-control">
            <Switch defaultChecked />

            <Label>Composed by hand</Label>
          </div>

          <Description>Read out after the label</Description>
        </Field>

        <Field className="flex-row items-center justify-between gap-x-3">
          <Label>Label before the switch</Label>

          <Switch />
        </Field>

        <div>
          <Typography appearance="subdued" className="mb-2">
            Bare, outside a Field
          </Typography>

          <Switch aria-label="Bare switch" />
        </div>
      </Section>
    </div>
  );
};

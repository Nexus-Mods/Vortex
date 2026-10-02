/** Demonstrates CheckboxField, and the Field parts and bare Checkbox it's built from. */

import React, { useState } from "react";

import { Checkbox } from "@/ui/components/form/checkbox/Checkbox";
import { Description } from "@/ui/components/form/field/Description";
import { Field } from "@/ui/components/form/field/Field";
import { Label } from "@/ui/components/form/field/Label";
import { FormDemoSection as Section } from "@/ui/components/form/FormDemoSection";
import { Typography } from "@/ui/components/typography/Typography";

import { CheckboxField } from "./CheckboxField";

const CHILD_LABELS = ["Textures", "Meshes", "Scripts"];

export const CheckboxFieldDemo = () => {
  const [children, setChildren] = useState<boolean[]>([true, false, false]);

  const allOn = children.every(Boolean);
  const noneOn = !children.some(Boolean);

  const setChild = (index: number, value: boolean) =>
    setChildren((current) => current.map((on, i) => (i === index ? value : on)));

  return (
    <div className="space-y-10">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h3" typographyType="heading-xs">
          Checkbox field
        </Typography>

        <Typography appearance="subdued">
          A checkbox with its label beside it, and hints and error under both. Clicking the label
          toggles it; onChange receives the new checked value, not an event.
        </Typography>
      </div>

      <Section
        description="Unchecked, checked and indeterminate, enabled and then disabled."
        title="States"
      >
        <CheckboxField checked={false} label="Unchecked" onChange={() => undefined} />

        <CheckboxField checked label="Checked" onChange={() => undefined} />

        <CheckboxField indeterminate label="Indeterminate" onChange={() => undefined} />

        <CheckboxField disabled checked={false} label="Unchecked, disabled" />

        <CheckboxField checked disabled label="Checked, disabled" />

        <CheckboxField disabled indeterminate label="Indeterminate, disabled" />
      </Section>

      <Section
        description="Hints and an error run full width under the checkbox and label, and are read out after it."
        title="Hints and errors"
      >
        <CheckboxField defaultChecked hints="Sent with the report" label="One hint" />

        <CheckboxField
          errorMessage="Required to continue"
          hints="You can withdraw later"
          label="Error and hint"
        />

        <CheckboxField hideLabel label="Hidden label" />
      </Section>

      <Section
        description="The label can be rich content, and a long one wraps with the checkbox kept at the top. A master checkbox is indeterminate while only some of its children are checked."
        title="Rich labels and indeterminate"
      >
        <CheckboxField
          defaultChecked
          label={
            <span className="block">
              <span className="block font-semibold text-neutral-strong">SkyUI</span>
              Needs SKSE installed and running, or its menus won't open.
            </span>
          }
        />

        <div className="col-span-2 space-y-2">
          <CheckboxField
            checked={allOn}
            indeterminate={!allOn && !noneOn}
            label="All file types"
            onChange={(checked) => setChildren(children.map(() => checked))}
          />

          <div className="ml-6 space-y-2">
            {CHILD_LABELS.map((childLabel, index) => (
              <CheckboxField
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
        description="CheckboxField is Field, Checkbox, Label, Description and ErrorMessage put together. Compose them directly for a layout it doesn't cover; Field links the label and descriptions to the checkbox itself."
        title="Building blocks"
      >
        <Field className="nxm-checkbox-field">
          <div className="nxm-field-control">
            <Checkbox defaultChecked />

            <Label>Composed by hand</Label>
          </div>

          <Description>Read out after the label</Description>
        </Field>

        <Field className="flex-row items-center justify-between gap-x-3">
          <Label>Label before the checkbox</Label>

          <Checkbox />
        </Field>

        <div>
          <Typography appearance="subdued" className="mb-2">
            Bare, outside a Field
          </Typography>

          <Checkbox aria-label="Bare checkbox" />
        </div>
      </Section>
    </div>
  );
};

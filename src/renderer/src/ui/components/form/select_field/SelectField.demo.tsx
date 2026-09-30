/** Demonstrates SelectField, and the Field parts and bare Select it's built from. */

import React, { useState } from "react";

import { Description } from "@/ui/components/form/field/Description";
import { ErrorMessage } from "@/ui/components/form/field/ErrorMessage";
import { Field } from "@/ui/components/form/field/Field";
import { Label } from "@/ui/components/form/field/Label";
import { FormDemoSection as Section } from "@/ui/components/form/FormDemoSection";
import { Select } from "@/ui/components/form/select/Select";
import { Typography } from "@/ui/components/typography/Typography";

import { SelectField } from "./SelectField";

const Options = () => (
  <>
    <option value="">Select an option...</option>
    <option value="1">Option 1</option>
    <option value="2">Option 2</option>
    <option value="3">Option 3</option>
  </>
);

export const SelectFieldDemo = () => {
  const [game, setGame] = useState("");

  return (
    <div className="space-y-10">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h3" typographyType="heading-xs">
          Select field
        </Typography>

        <Typography appearance="subdued">
          A native select with its label, hints and error. The label is always required; hideLabel
          hides it on screen only.
        </Typography>
      </div>

      <Section description="How the select looks as its state changes." title="States">
        <SelectField label="Default">
          <Options />
        </SelectField>

        <SelectField defaultValue="2" label="Selected">
          <Options />
        </SelectField>

        <SelectField required label="Required">
          <Options />
        </SelectField>

        <SelectField disabled label="Disabled">
          <Options />
        </SelectField>

        <SelectField defaultValue="2" disabled label="Disabled and selected">
          <Options />
        </SelectField>

        <SelectField errorMessage="This option isn't valid" label="Invalid">
          <Options />
        </SelectField>
      </Section>

      <Section
        description="Hints sit under the select; an error goes above them. Both are read out after the label."
        title="Hints and errors"
      >
        <SelectField hints="Used for new profiles" label="One hint">
          <Options />
        </SelectField>

        <SelectField
          hints={["Used for new profiles", "Existing profiles keep theirs"]}
          label="Several hints"
        >
          <Options />
        </SelectField>

        <SelectField
          errorMessage="Pick an option"
          hints="Used for new profiles"
          label="Error and hint"
        >
          <Options />
        </SelectField>
      </Section>

      <Section
        description="Option groups and long lists are drawn by the native menu."
        title="Options"
      >
        <SelectField label="Grouped" value={game} onChange={(event) => setGame(event.target.value)}>
          <option value="">Select a game...</option>

          <optgroup label="Bethesda">
            <option value="skyrimse">Skyrim Special Edition</option>
            <option value="fallout4">Fallout 4</option>
            <option value="starfield">Starfield</option>
          </optgroup>

          <optgroup label="CD Projekt RED">
            <option value="witcher3">The Witcher 3</option>
            <option value="cyberpunk">Cyberpunk 2077</option>
          </optgroup>
        </SelectField>

        <SelectField label="Many options">
          <option value="">Select a number...</option>

          {Array.from({ length: 50 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              Option {i + 1}
            </option>
          ))}
        </SelectField>

        <SelectField hideLabel label="Hidden label">
          <option value="">Label is screen-reader only</option>
          <option value="1">Option 1</option>
        </SelectField>
      </Section>

      <Section
        description="SelectField is Field, Label, Select, Description and ErrorMessage put together. Compose them directly for a layout it doesn't cover; Field links the label and descriptions to the select itself."
        title="Building blocks"
      >
        <Field>
          <Label required>Composed by hand</Label>

          <Select required>
            <Options />
          </Select>

          <Description>Read out after the label</Description>
        </Field>

        <Field>
          <Label>Composed with an error</Label>

          <Select invalid>
            <Options />
          </Select>

          <ErrorMessage>Explains the invalid state</ErrorMessage>
        </Field>

        <div>
          <Typography appearance="subdued" className="mb-2">
            Bare, outside a Field
          </Typography>

          <Select aria-label="Bare select">
            <Options />
          </Select>
        </div>
      </Section>
    </div>
  );
};

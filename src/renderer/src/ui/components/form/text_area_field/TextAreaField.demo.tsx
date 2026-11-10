/** Demonstrates TextAreaField, and the Field parts and bare Textarea it's built from. */

import React from "react";

import { Description } from "@/ui/components/form/field/Description";
import { ErrorMessage } from "@/ui/components/form/field/ErrorMessage";
import { Field } from "@/ui/components/form/field/Field";
import { Label } from "@/ui/components/form/field/Label";
import { FormDemoSection as Section } from "@/ui/components/form/FormDemoSection";
import { Textarea } from "@/ui/components/form/textarea/Textarea";
import { Typography } from "@/ui/components/typography/Typography";

import { TextAreaField } from "./TextAreaField";

export const TextAreaFieldDemo = () => (
  <div className="space-y-10">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h3" typographyType="heading-xs">
        Text area field
      </Typography>

      <Typography appearance="subdued">
        A multi-line text input with its label, hints, error and character count. It takes the same
        field props as TextField and grows downwards. The label is always required; hideLabel hides
        it on screen only.
      </Typography>
    </div>

    <Section description="How the text area looks as its state changes." title="States">
      <TextAreaField label="Default" placeholder="Placeholder text" />

      <TextAreaField defaultValue={"Some text\nover two lines"} label="Filled" />

      <TextAreaField required label="Required" placeholder="Must be filled in" />

      <TextAreaField disabled label="Disabled" placeholder="Can't be edited" />

      <TextAreaField readOnly defaultValue="Can't be changed" label="Read-only" />

      <TextAreaField
        defaultValue="Bad value"
        errorMessage="This value isn't valid"
        label="Invalid"
      />
    </Section>

    <Section
      description="Hints sit under the text area; an error goes above them. Both are read out after the label."
      title="Hints and errors"
    >
      <TextAreaField hints="Plain text only" label="One hint" />

      <TextAreaField
        hints={["At least 20 characters", "No links", "Say what you tried"]}
        label="Several hints"
      />

      <TextAreaField
        defaultValue="Too short"
        errorMessage="Too short"
        hints="At least 20 characters"
        label="Error and hint"
      />

      <TextAreaField
        hideErrors
        defaultValue="Bad value"
        errorMessage="Kept off screen, still read out"
        label="Error hidden on screen"
      />
    </Section>

    <Section
      description="Given maxLength. Turns to warning with a quarter left, and danger with a tenth."
      title="Character count"
    >
      <TextAreaField label="Plenty left" maxLength={100} placeholder="Type up to 100 characters" />

      <TextAreaField defaultValue={"1234567890".repeat(8)} label="Warning" maxLength={100} />

      <TextAreaField
        defaultValue={"1234567890".repeat(9) + "12345"}
        label="Danger"
        maxLength={100}
      />
    </Section>

    <Section description="A label kept for screen readers only." title="Hidden label">
      <TextAreaField
        hideLabel
        fieldClassName="col-start-1"
        label="Hidden label"
        placeholder="Label is screen-reader only"
      />
    </Section>

    <Section
      description="TextAreaField is Field, Label, Textarea, Description and ErrorMessage put together. Compose them directly for a layout it doesn't cover; Field links the label and descriptions to the text area itself."
      title="Building blocks"
    >
      <Field>
        <Label required>Composed by hand</Label>

        <Textarea required placeholder="Named by the Label" />

        <Description>Read out after the label</Description>
      </Field>

      <Field>
        <Label>Composed with an error</Label>

        <Textarea invalid defaultValue="Bad value" />

        <ErrorMessage>Explains the invalid state</ErrorMessage>
      </Field>

      <div>
        <Typography appearance="subdued" className="mb-2">
          Bare, outside a Field
        </Typography>

        <Textarea aria-label="Bare text area" placeholder="Named by its aria-label" />
      </div>
    </Section>
  </div>
);

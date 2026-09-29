/** Demonstrates TextField, and the Field parts and bare Input it's built from. */

import { mdiMagnify } from "@mdi/js";
import React, { type ReactNode } from "react";

import { Description } from "@/ui/components/form/field/Description";
import { ErrorMessage } from "@/ui/components/form/field/ErrorMessage";
import { Field } from "@/ui/components/form/field/Field";
import { Label } from "@/ui/components/form/field/Label";
import { Input } from "@/ui/components/form/input/Input";
import { Typography } from "@/ui/components/typography/Typography";

import { TextField } from "./TextField";

const Section = ({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) => (
  <div className="space-y-4">
    <div className="space-y-1">
      <Typography as="h4" typographyType="heading-xs">
        {title}
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        {description}
      </Typography>
    </div>

    <div className="grid grid-cols-[repeat(3,15rem)] items-start gap-x-6 gap-y-6">{children}</div>
  </div>
);

export const TextFieldDemo = () => (
  <div className="space-y-10">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h3" typographyType="heading-xs">
        Text field
      </Typography>

      <Typography appearance="subdued">
        A text input with its label, hints, error and character count. The label is always required;
        hideLabel hides it on screen only.
      </Typography>
    </div>

    <Section description="How the input looks as its state changes." title="States">
      <TextField label="Default" placeholder="Placeholder text" />

      <TextField defaultValue="Some text" label="Filled" />

      <TextField required label="Required" placeholder="Must be filled in" />

      <TextField disabled label="Disabled" placeholder="Can't be edited" />

      <TextField readOnly defaultValue="Can't be changed" label="Read-only" />

      <TextField defaultValue="Bad value" errorMessage="This value isn't valid" label="Invalid" />
    </Section>

    <Section
      description="Hints sit under the input; an error goes above them. Both are read out after the label."
      title="Hints and errors"
    >
      <TextField hints="At least 3 characters" label="One hint" />

      <TextField
        hints={["At least 8 characters", "Upper and lower case", "At least one number"]}
        label="Several hints"
        type="password"
      />

      <TextField
        defaultValue="ab"
        errorMessage="Too short"
        hints="At least 3 characters"
        label="Error and hint"
      />
    </Section>

    <Section
      description="Given maxLength. Turns to warning with a quarter left, and danger with a tenth."
      title="Character count"
    >
      <TextField label="Plenty left" maxLength={20} placeholder="Type up to 20 characters" />

      <TextField defaultValue="1234567890123456" label="Warning" maxLength={20} />

      <TextField defaultValue="1234567890123456789" label="Danger" maxLength={20} />
    </Section>

    <Section
      description="An icon inside the input, and a label kept for screen readers only."
      title="Icon and hidden label"
    >
      <TextField label="Icon" leftIconPath={mdiMagnify} placeholder="Search..." />

      <TextField
        hideLabel
        fieldClassName="col-start-1"
        label="Hidden label"
        placeholder="Label is screen-reader only"
      />
    </Section>

    <Section description="The input's type is passed straight through." title="Input types">
      <TextField label="Text" placeholder="Some text" />

      <TextField label="Email" placeholder="user@example.com" type="email" />

      <TextField label="Password" placeholder="Password" type="password" />

      <TextField label="URL" placeholder="https://example.com" type="url" />

      <TextField defaultValue={42} label="Number" type="number" />

      <TextField label="Date" type="date" />

      <TextField label="Time" type="time" />
    </Section>

    <Section
      description="TextField is Field, Label, Input, Description and ErrorMessage put together. Compose them directly for a layout it doesn't cover; Field links the label and descriptions to the input itself."
      title="Building blocks"
    >
      <Field>
        <Label required>Composed by hand</Label>

        <Input required placeholder="Named by the Label" />

        <Description>Read out after the label</Description>
      </Field>

      <Field>
        <Label>Composed with an error</Label>

        <Input invalid defaultValue="Bad value" />

        <ErrorMessage>Explains the invalid state</ErrorMessage>
      </Field>

      <div>
        <Typography appearance="subdued" className="mb-2">
          Bare, outside a Field
        </Typography>

        <Input aria-label="Bare input" placeholder="Named by its aria-label" />
      </div>
    </Section>
  </div>
);

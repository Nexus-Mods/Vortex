/** Demonstrates TextAreaField, the multi-line sibling of TextField. */

import React from "react";

import { FormDemoSection as Section } from "@/ui/components/form/FormDemoSection";
import { Typography } from "@/ui/components/typography/Typography";

import { TextAreaField } from "./TextAreaField";

export const TextAreaFieldDemo = () => (
  <div className="space-y-10">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h3" typographyType="heading-xs">
        Text area field
      </Typography>

      <Typography appearance="subdued">
        A multi-line text input with its label, hints and error. It looks like TextField and grows
        downwards. The label is always required; hideLabel hides it on screen only.
      </Typography>
    </div>

    <Section description="How the text area looks as its state changes." title="States">
      <TextAreaField label="Default" placeholder="Placeholder text" />

      <TextAreaField defaultValue={"Some text\nover two lines"} label="Filled" />

      <TextAreaField disabled label="Disabled" placeholder="Can't be edited" />

      <TextAreaField
        defaultValue="Bad value"
        errorMessage="This value isn't valid"
        label="Invalid"
      />
    </Section>

    <Section description="Hints sit under the text area." title="Hints">
      <TextAreaField hints="Plain text only" label="One hint" />
    </Section>
  </div>
);

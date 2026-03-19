/**
 * InputDemo Component
 * Demonstrates all Input component variants and features
 */

import React, { useState } from "react";

import { Typography } from "../../typography/Typography";
import { Input } from "./Input";

export const InputDemo = () => {
  const [textValue, setTextValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h3" typographyType="heading-xs">
          Input
        </Typography>

        <Typography appearance="subdued">
          Text inputs for various data types with validation, hints, and
          character counting.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Input Types
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Input
            id="text-input"
            label="Text Input"
            placeholder="Enter some text..."
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
          />

          <Input
            id="email-input"
            label="Email Input"
            placeholder="user@example.com"
            type="email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
          />

          <Input
            id="password-input"
            label="Password Input"
            placeholder="Enter password..."
            type="password"
            value={passwordValue}
            onChange={(e) => setPasswordValue(e.target.value)}
          />

          <Input
            id="url-input"
            label="URL Input"
            placeholder="https://example.com"
            type="url"
          />

          <Input
            defaultValue={42}
            id="number-input"
            label="Number Input"
            placeholder="Enter a number..."
            type="number"
          />

          <Input id="date-input" label="Date Input" type="date" />

          <Input id="time-input" label="Time Input" type="time" />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Sizes
        </Typography>

        <div className="flex flex-wrap items-end gap-4">
          <Input
            id="size-md-input"
            label="Medium (default)"
            placeholder="Medium input..."
            type="text"
          />

          <Input
            id="size-sm-input"
            label="Small"
            placeholder="Small input..."
            size="sm"
            type="text"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Input States
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Input
            id="default-input"
            label="Default State"
            placeholder="Default input..."
            type="text"
          />

          <Input
            defaultValue="Pre-filled value"
            id="with-value-input"
            label="With Value"
            type="text"
          />

          <Input
            disabled={true}
            id="disabled-input"
            label="Disabled State"
            placeholder="Cannot edit..."
            type="text"
          />

          <Input
            defaultValue="Read-only value"
            id="readonly-input"
            label="Read-only State"
            readOnly={true}
            type="text"
          />

          <Input
            id="required-input"
            label="Required Field"
            placeholder="This field is required..."
            required={true}
            type="text"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Validation & Error States
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Input
            defaultValue="Invalid value"
            errorMessage="This field has an error"
            id="error-input"
            label="Input with Error"
            type="text"
          />

          <Input
            errorMessage="Please enter a valid email address"
            id="error-required-input"
            label="Required Field with Error"
            required={true}
            type="email"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Hints & Helper Text
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Input
            hints="Username must be at least 3 characters"
            id="single-hint-input"
            label="Input with Single Hint"
            placeholder="Enter username..."
            type="text"
          />

          <Input
            hints={[
              "Must be at least 8 characters",
              "Must contain uppercase and lowercase letters",
              "Must contain at least one number",
            ]}
            id="multiple-hints-input"
            label="Input with Multiple Hints"
            placeholder="Enter secure password..."
            type="password"
          />

          <Input
            defaultValue="ab"
            errorMessage="Value is too short"
            hints="This hint is shown along with the error"
            id="hint-error-input"
            label="Hints with Error State"
            type="text"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Character Counter
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Input
            hints="Character counter appears below"
            id="maxlength-input"
            label="Input with Character Counter"
            maxLength={50}
            placeholder="Type up to 50 characters..."
            type="text"
          />

          <Input
            defaultValue="12345678901234"
            hints="Type more to see warning threshold (yellow at 25%, red at 10%)"
            id="maxlength-warning-input"
            label="Counter Warning (25% threshold)"
            maxLength={20}
            type="text"
          />

          <Input
            defaultValue="12345678901234567"
            hints="Very close to character limit (red)"
            id="maxlength-danger-input"
            label="Counter Danger (10% threshold)"
            maxLength={20}
            type="text"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Hidden Labels (Screen Reader Only)
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Input
            hideLabel={true}
            id="hidden-label-input"
            label="Hidden Label (SR only)"
            placeholder="Label is visually hidden but accessible to screen readers"
            type="text"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Combined Features
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Input
            hints={[
              "Username must be unique",
              "Only alphanumeric characters allowed",
            ]}
            id="full-featured-input"
            label="Username"
            maxLength={30}
            placeholder="Enter username..."
            required={true}
            type="text"
          />

          <Input
            hints="Keep it short and sweet"
            id="bio-input"
            label="Bio"
            maxLength={200}
            placeholder="Tell us about yourself..."
            type="text"
          />
        </div>
      </div>
    </div>
  );
};

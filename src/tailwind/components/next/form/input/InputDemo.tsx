/**
 * InputDemo Component
 * Demonstrates all Input component variants and features
 */

import * as React from 'react';
import { useState } from 'react';

import { Input } from './Input';
import { FormFieldWrap } from '../formfield';
import { Typography } from '../../typography/Typography';

export const InputDemo = () => {
  const [textValue, setTextValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');

  return (
    <div className="tw:p-8 tw:bg-surface-base tw:min-h-screen">
      <Typography as="h1" typographyType="heading-xl" className="tw:mb-8">
        Input Component Demo
      </Typography>

      {/* Basic Input Types */}
      <div className="tw:mb-12">
        <Typography as="h2" typographyType="heading-md" className="tw:mb-4">
          Input Types
        </Typography>
        <FormFieldWrap>
          <Input
            id="text-input"
            label="Text Input"
            type="text"
            placeholder="Enter some text..."
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
          />

          <Input
            id="email-input"
            label="Email Input"
            type="email"
            placeholder="user@example.com"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
          />

          <Input
            id="password-input"
            label="Password Input"
            type="password"
            placeholder="Enter password..."
            value={passwordValue}
            onChange={(e) => setPasswordValue(e.target.value)}
          />

          <Input
            id="url-input"
            label="URL Input"
            type="url"
            placeholder="https://example.com"
          />

          <Input
            id="number-input"
            label="Number Input"
            type="number"
            placeholder="Enter a number..."
            defaultValue={42}
          />

          <Input
            id="date-input"
            label="Date Input"
            type="date"
          />

          <Input
            id="time-input"
            label="Time Input"
            type="time"
          />
        </FormFieldWrap>
      </div>

      {/* States */}
      <div className="tw:mb-12">
        <Typography as="h2" typographyType="heading-md" className="tw:mb-4">
          Input States
        </Typography>
        <FormFieldWrap>
          <Input
            id="default-input"
            label="Default State"
            type="text"
            placeholder="Default input..."
          />

          <Input
            id="with-value-input"
            label="With Value"
            type="text"
            defaultValue="Pre-filled value"
          />

          <Input
            id="disabled-input"
            label="Disabled State"
            type="text"
            placeholder="Cannot edit..."
            disabled
          />

          <Input
            id="readonly-input"
            label="Read-only State"
            type="text"
            defaultValue="Read-only value"
            readOnly
          />

          <Input
            id="required-input"
            label="Required Field"
            type="text"
            placeholder="This field is required..."
            required
          />
        </FormFieldWrap>
      </div>

      {/* Validation & Errors */}
      <div className="tw:mb-12">
        <Typography as="h2" typographyType="heading-md" className="tw:mb-4">
          Validation & Error States
        </Typography>
        <FormFieldWrap>
          <Input
            id="error-input"
            label="Input with Error"
            type="text"
            errorMessage="This field has an error"
            defaultValue="Invalid value"
          />

          <Input
            id="error-required-input"
            label="Required Field with Error"
            type="email"
            required
            errorMessage="Please enter a valid email address"
          />
        </FormFieldWrap>
      </div>

      {/* Hints & Helper Text */}
      <div className="tw:mb-12">
        <Typography as="h2" typographyType="heading-md" className="tw:mb-4">
          Hints & Helper Text
        </Typography>
        <FormFieldWrap>
          <Input
            id="single-hint-input"
            label="Input with Single Hint"
            type="text"
            placeholder="Enter username..."
            hints="Username must be at least 3 characters"
          />

          <Input
            id="multiple-hints-input"
            label="Input with Multiple Hints"
            type="password"
            placeholder="Enter secure password..."
            hints={[
              'Must be at least 8 characters',
              'Must contain uppercase and lowercase letters',
              'Must contain at least one number',
            ]}
          />

          <Input
            id="hint-error-input"
            label="Hints with Error State"
            type="text"
            hints="This hint is shown along with the error"
            errorMessage="Value is too short"
            defaultValue="ab"
          />
        </FormFieldWrap>
      </div>

      {/* Character Counter */}
      <div className="tw:mb-12">
        <Typography as="h2" typographyType="heading-md" className="tw:mb-4">
          Character Counter
        </Typography>
        <FormFieldWrap>
          <Input
            id="maxlength-input"
            label="Input with Character Counter"
            type="text"
            maxLength={50}
            placeholder="Type up to 50 characters..."
            hints="Character counter appears below"
          />

          <Input
            id="maxlength-warning-input"
            label="Counter Warning (25% threshold)"
            type="text"
            maxLength={20}
            defaultValue="12345678901234"
            hints="Type more to see warning threshold (yellow at 25%, red at 10%)"
          />

          <Input
            id="maxlength-danger-input"
            label="Counter Danger (10% threshold)"
            type="text"
            maxLength={20}
            defaultValue="12345678901234567"
            hints="Very close to character limit (red)"
          />
        </FormFieldWrap>
      </div>

      {/* Hidden Labels (Accessibility) */}
      <div className="tw:mb-12">
        <Typography as="h2" typographyType="heading-md" className="tw:mb-4">
          Hidden Labels (Screen Reader Only)
        </Typography>
        <FormFieldWrap>
          <Input
            id="hidden-label-input"
            label="Hidden Label (SR only)"
            type="text"
            placeholder="Label is visually hidden but accessible to screen readers"
            hideLabel
          />
        </FormFieldWrap>
      </div>

      {/* Combined Features */}
      <div className="tw:mb-12">
        <Typography as="h2" typographyType="heading-md" className="tw:mb-4">
          Combined Features
        </Typography>
        <FormFieldWrap>
          <Input
            id="full-featured-input"
            label="Username"
            type="text"
            placeholder="Enter username..."
            required
            maxLength={30}
            hints={[
              'Username must be unique',
              'Only alphanumeric characters allowed',
            ]}
          />

          <Input
            id="bio-input"
            label="Bio"
            type="text"
            placeholder="Tell us about yourself..."
            maxLength={200}
            hints="Keep it short and sweet"
          />
        </FormFieldWrap>
      </div>
    </div>
  );
};

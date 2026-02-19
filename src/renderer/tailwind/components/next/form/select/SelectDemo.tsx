/**
 * SelectDemo Component
 * Demonstrates all Select component variants and features
 */

import * as React from "react";
import { useState } from "react";

import { Select } from "./Select";
import { FormFieldWrap } from "../formfield";
import { Typography } from "../../typography/Typography";

export const SelectDemo = () => {
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("en");
  const [game, setGame] = useState("");

  return (
    <div className="p-8 bg-surface-base min-h-screen">
      <Typography as="h1" typographyType="heading-xl" className="mb-8">
        Select Component Demo
      </Typography>

      {/* Basic Select */}
      <div className="mb-12">
        <Typography as="h2" typographyType="heading-md" className="mb-4">
          Basic Select
        </Typography>
        <FormFieldWrap>
          <Select
            id="basic-select"
            label="Basic Select"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">Select an option...</option>
            <option value="option1">Option 1</option>
            <option value="option2">Option 2</option>
            <option value="option3">Option 3</option>
          </Select>

          <Select
            id="country-select"
            label="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">Select a country...</option>
            <option value="us">United States</option>
            <option value="uk">United Kingdom</option>
            <option value="ca">Canada</option>
            <option value="au">Australia</option>
            <option value="de">Germany</option>
            <option value="fr">France</option>
            <option value="jp">Japan</option>
          </Select>

          <Select
            id="language-select"
            label="Language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
            <option value="zh">Chinese</option>
          </Select>
        </FormFieldWrap>
      </div>

      {/* States */}
      <div className="mb-12">
        <Typography as="h2" typographyType="heading-md" className="mb-4">
          Select States
        </Typography>
        <FormFieldWrap>
          <Select id="default-select" label="Default State">
            <option value="">Select...</option>
            <option value="1">Option 1</option>
            <option value="2">Option 2</option>
          </Select>

          <Select id="disabled-select" label="Disabled State" disabled>
            <option value="">Cannot select...</option>
            <option value="1">Option 1</option>
            <option value="2">Option 2</option>
          </Select>

          <Select id="required-select" label="Required Field" required>
            <option value="">Please select...</option>
            <option value="1">Option 1</option>
            <option value="2">Option 2</option>
          </Select>

          <Select
            id="preselected-select"
            label="Pre-selected Value"
            defaultValue="option2"
          >
            <option value="option1">Option 1</option>
            <option value="option2">Option 2 (Selected)</option>
            <option value="option3">Option 3</option>
          </Select>
        </FormFieldWrap>
      </div>

      {/* Validation & Errors */}
      <div className="mb-12">
        <Typography as="h2" typographyType="heading-md" className="mb-4">
          Validation & Error States
        </Typography>
        <FormFieldWrap>
          <Select
            id="error-select"
            label="Select with Error"
            errorMessage="This field has an error"
          >
            <option value="">Select...</option>
            <option value="1">Option 1</option>
            <option value="2">Option 2</option>
          </Select>

          <Select
            id="error-required-select"
            label="Required Field with Error"
            required
            errorMessage="Please select a valid option"
          >
            <option value="">Please select...</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="guest">Guest</option>
          </Select>
        </FormFieldWrap>
      </div>

      {/* Hints & Helper Text */}
      <div className="mb-12">
        <Typography as="h2" typographyType="heading-md" className="mb-4">
          Hints & Helper Text
        </Typography>
        <FormFieldWrap>
          <Select
            id="single-hint-select"
            label="Select with Single Hint"
            hints="Choose your preferred option"
          >
            <option value="">Select...</option>
            <option value="basic">Basic</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </Select>

          <Select
            id="multiple-hints-select"
            label="Select with Multiple Hints"
            hints={[
              "This selection affects your experience",
              "You can change this later in settings",
            ]}
          >
            <option value="">Select theme...</option>
            <option value="light">Light Theme</option>
            <option value="dark">Dark Theme</option>
            <option value="auto">Auto (System)</option>
          </Select>

          <Select
            id="hint-error-select"
            label="Hints with Error State"
            hints="Please select a valid region"
            errorMessage="Region is required"
          >
            <option value="">Select region...</option>
            <option value="na">North America</option>
            <option value="eu">Europe</option>
            <option value="asia">Asia</option>
          </Select>
        </FormFieldWrap>
      </div>

      {/* Grouped Options (optgroup) */}
      <div className="mb-12">
        <Typography as="h2" typographyType="heading-md" className="mb-4">
          Grouped Options
        </Typography>
        <FormFieldWrap>
          <Select
            id="game-select"
            label="Select Game"
            value={game}
            onChange={(e) => setGame(e.target.value)}
          >
            <option value="">Select a game...</option>
            <optgroup label="Bethesda Games">
              <option value="skyrim">The Elder Scrolls V: Skyrim</option>
              <option value="skyrimse">Skyrim Special Edition</option>
              <option value="fallout4">Fallout 4</option>
              <option value="fallout76">Fallout 76</option>
              <option value="starfield">Starfield</option>
            </optgroup>
            <optgroup label="CD Projekt RED">
              <option value="witcher3">The Witcher 3</option>
              <option value="cyberpunk">Cyberpunk 2077</option>
            </optgroup>
            <optgroup label="FromSoftware">
              <option value="eldenring">Elden Ring</option>
              <option value="darksouls3">Dark Souls III</option>
              <option value="sekiro">Sekiro</option>
            </optgroup>
          </Select>

          <Select id="category-select" label="Select Category">
            <option value="">All Categories...</option>
            <optgroup label="Gameplay">
              <option value="combat">Combat</option>
              <option value="magic">Magic</option>
              <option value="stealth">Stealth</option>
            </optgroup>
            <optgroup label="Visual">
              <option value="textures">Textures</option>
              <option value="lighting">Lighting</option>
              <option value="weather">Weather</option>
            </optgroup>
            <optgroup label="Audio">
              <option value="music">Music</option>
              <option value="sfx">Sound Effects</option>
              <option value="voice">Voice</option>
            </optgroup>
          </Select>
        </FormFieldWrap>
      </div>

      {/* Many Options */}
      <div className="mb-12">
        <Typography as="h2" typographyType="heading-md" className="mb-4">
          Many Options
        </Typography>
        <FormFieldWrap>
          <Select
            id="many-options-select"
            label="Select from Many Options"
            hints="A long list of options to demonstrate scrolling"
          >
            <option value="">Select a number...</option>
            {Array.from({ length: 50 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Option {i + 1}
              </option>
            ))}
          </Select>
        </FormFieldWrap>
      </div>

      {/* Combined Features */}
      <div className="mb-12">
        <Typography as="h2" typographyType="heading-md" className="mb-4">
          Combined Features
        </Typography>
        <FormFieldWrap>
          <Select
            id="role-select"
            label="User Role"
            required
            hints={[
              "Select the appropriate role for this user",
              "Roles determine access permissions",
            ]}
          >
            <option value="">Select role...</option>
            <optgroup label="Administrative">
              <option value="superadmin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
            </optgroup>
            <optgroup label="Standard Users">
              <option value="user">User</option>
              <option value="guest">Guest</option>
            </optgroup>
          </Select>

          <Select
            id="priority-select"
            label="Priority Level"
            required
            defaultValue="medium"
            hints="Choose the priority level for this task"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </FormFieldWrap>
      </div>
    </div>
  );
};

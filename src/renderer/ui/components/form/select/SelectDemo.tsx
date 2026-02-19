/**
 * SelectDemo Component
 * Demonstrates all Select component variants and features
 */

import React, { useState } from "react";

import { Typography } from "../../typography/Typography";
import { Select } from "./Select";

export const SelectDemo = () => {
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("en");
  const [game, setGame] = useState("");

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h3" typographyType="heading-xs">
          Select
        </Typography>

        <Typography appearance="subdued">
          Dropdown select inputs with support for grouped options, validation,
          and hints.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Basic Select
        </Typography>

        <div className="flex flex-wrap gap-4">
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
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Select States
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Select id="default-select" label="Default State">
            <option value="">Select...</option>

            <option value="1">Option 1</option>

            <option value="2">Option 2</option>
          </Select>

          <Select disabled={true} id="disabled-select" label="Disabled State">
            <option value="">Cannot select...</option>

            <option value="1">Option 1</option>

            <option value="2">Option 2</option>
          </Select>

          <Select id="required-select" label="Required Field" required={true}>
            <option value="">Please select...</option>

            <option value="1">Option 1</option>

            <option value="2">Option 2</option>
          </Select>

          <Select
            defaultValue="option2"
            id="preselected-select"
            label="Pre-selected Value"
          >
            <option value="option1">Option 1</option>

            <option value="option2">Option 2 (Selected)</option>

            <option value="option3">Option 3</option>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Validation & Error States
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Select
            errorMessage="This field has an error"
            id="error-select"
            label="Select with Error"
          >
            <option value="">Select...</option>

            <option value="1">Option 1</option>

            <option value="2">Option 2</option>
          </Select>

          <Select
            errorMessage="Please select a valid option"
            id="error-required-select"
            label="Required Field with Error"
            required={true}
          >
            <option value="">Please select...</option>

            <option value="admin">Admin</option>

            <option value="user">User</option>

            <option value="guest">Guest</option>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Hints & Helper Text
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Select
            hints="Choose your preferred option"
            id="single-hint-select"
            label="Select with Single Hint"
          >
            <option value="">Select...</option>

            <option value="basic">Basic</option>

            <option value="advanced">Advanced</option>

            <option value="expert">Expert</option>
          </Select>

          <Select
            hints={[
              "This selection affects your experience",
              "You can change this later in settings",
            ]}
            id="multiple-hints-select"
            label="Select with Multiple Hints"
          >
            <option value="">Select theme...</option>

            <option value="light">Light Theme</option>

            <option value="dark">Dark Theme</option>

            <option value="auto">Auto (System)</option>
          </Select>

          <Select
            errorMessage="Region is required"
            hints="Please select a valid region"
            id="hint-error-select"
            label="Hints with Error State"
          >
            <option value="">Select region...</option>

            <option value="na">North America</option>

            <option value="eu">Europe</option>

            <option value="asia">Asia</option>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Grouped Options
        </Typography>

        <div className="flex flex-wrap gap-4">
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
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Many Options
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Select
            hints="A long list of options to demonstrate scrolling"
            id="many-options-select"
            label="Select from Many Options"
          >
            <option value="">Select a number...</option>

            {Array.from({ length: 50 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Option {i + 1}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Combined Features
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Select
            hints={[
              "Select the appropriate role for this user",
              "Roles determine access permissions",
            ]}
            id="role-select"
            label="User Role"
            required={true}
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
            defaultValue="medium"
            hints="Choose the priority level for this task"
            id="priority-select"
            label="Priority Level"
            required={true}
          >
            <option value="critical">Critical</option>

            <option value="high">High</option>

            <option value="medium">Medium</option>

            <option value="low">Low</option>
          </Select>
        </div>
      </div>
    </div>
  );
};

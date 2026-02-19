/**
 * Picker Demo Component
 * Demonstrates the Picker component variants and features
 */

import { mdiPalette, mdiTranslate } from "@mdi/js";
import React, { useState } from "react";

import { type IListboxOption } from "../listbox/ListboxOption";
import { Typography } from "../typography/Typography";
import { Picker } from "./Picker";

const sortOptions = [
  {
    label: "Recently Listed",
    value: { field: "createdAt", direction: "DESC" },
  },
  {
    label: "Most Endorsed",
    value: { field: "endorsements", direction: "DESC" },
  },
  {
    label: "Highest Rated",
    value: { field: "recentRating", direction: "DESC" },
  },
  {
    label: "Most Downloaded",
    value: { field: "downloads", direction: "DESC" },
  },
] satisfies IListboxOption<{ field: string; direction: "ASC" | "DESC" }>[];

const colorOptions = [
  { label: "Red", value: "red" },
  { label: "Orange", value: "orange" },
  { label: "Yellow", value: "yellow" },
  { label: "Green", value: "green" },
  { label: "Blue", value: "blue" },
  { label: "Purple", value: "purple" },
] satisfies IListboxOption<string>[];

const languageOptions = [
  { label: "English", value: "en", iconPath: mdiTranslate },
  { label: "French", value: "fr", iconPath: mdiTranslate },
  { label: "German", value: "de", iconPath: mdiTranslate },
  { label: "Spanish", value: "es", iconPath: mdiTranslate },
  { label: "Japanese", value: "ja", iconPath: mdiTranslate },
] satisfies IListboxOption<string>[];

const themeOptions = [
  { label: "Default", value: "default", iconPath: mdiPalette },
  { label: "Dark", value: "dark", iconPath: mdiPalette },
  { label: "Light", value: "light", iconPath: mdiPalette },
  { label: "High Contrast", value: "high-contrast", iconPath: mdiPalette },
] satisfies IListboxOption<string>[];

export const PickerDemo = () => {
  const [color, setColor] = useState("blue");
  const [language, setLanguage] = useState("en");
  const [region, setRegion] = useState("eu");
  const [theme, setTheme] = useState("default");
  const [sortBy, setSortBy] = useState(sortOptions[0].value);

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          Picker
        </Typography>

        <Typography appearance="subdued">
          Single-value selection built on Headless UI Listbox. Use Picker when
          the user needs to choose one value from a list, with the selected
          option shown in the trigger button. Unlike Dropdown which triggers
          actions, Picker manages selection state.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Basic Picker
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Picker
            options={colorOptions}
            placement="left"
            value={color}
            onChange={setColor}
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          With Icons and Multiple
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Options can include icons via the iconPath prop. Multiple pickers can
          be used together for related selections.
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Picker
            options={themeOptions}
            placement="left"
            value={theme}
            onChange={setTheme}
          />

          <Picker
            options={languageOptions}
            placement="left"
            value={language}
            onChange={setLanguage}
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Object Values
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          The value prop is generic and can be any type, including objects. Here
          each sort option carries both a field name and direction.
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Picker
            options={sortOptions}
            placement="left"
            value={sortBy}
            onChange={setSortBy}
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Design Notes
        </Typography>

        <Typography
          appearance="subdued"
          as="ul"
          className="list-inside list-disc space-y-2"
        >
          <li>
            The value prop accepts any type via generics — strings, numbers, or
            objects
          </li>

          <li>
            Selected option is shown in the trigger button with an unfold
            chevron
          </li>

          <li>
            A checkmark icon appears next to the currently selected option
          </li>

          <li>Options can include icons via the iconPath or icon props</li>
        </Typography>
      </div>
    </div>
  );
};

/**
 * Pictogram Demo Component
 * Demonstrates the Pictogram component variants and features
 */

import React from "react";

import { Typography } from "../typography/Typography";
import { Pictogram, type PictogramName } from "./Pictogram";

const sizes = [
  "4xs",
  "3xs",
  "2xs",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
] as const;

const themes = ["primary", "premium", "creator", "info", "none"] as const;

export const PictogramDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Pictogram
      </Typography>

      <Typography appearance="subdued">
        Decorative SVG pictograms loaded from assets/pictograms/. Used for
        illustrative purposes in empty states, onboarding, and feature
        highlights.
      </Typography>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Sizes
      </Typography>

      <div className="flex flex-wrap items-end gap-6">
        {sizes.map((size) => (
          <div className="flex flex-col items-center gap-2" key={size}>
            <Pictogram name="health-check" size={size} />

            <Typography appearance="subdued" typographyType="body-sm">
              {size}
            </Typography>
          </div>
        ))}
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Themes
      </Typography>

      <div className="flex flex-wrap items-end gap-6">
        {themes.map((theme) => (
          <div className="flex flex-col items-center gap-2" key={theme}>
            <Pictogram name="health-check" size="lg" theme={theme} />

            <Typography appearance="subdued" typographyType="body-sm">
              {theme}
            </Typography>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/**
 * Compare Slider Demo Component
 * Demonstrates a before/after comparison, as Browse shows a mod's gallery and description ones
 */

import React from "react";

import { Typography } from "@/ui/components/typography/Typography";

import { CompareSlider } from "./CompareSlider";

// A colourful picture by id, as a seed can land on one that's already black and white.
const after = { src: "https://picsum.photos/id/1015/1280/720" };
const before = { src: "https://picsum.photos/id/1015/1280/720?grayscale" };

export const CompareSliderDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Compare slider
      </Typography>

      <Typography appearance="subdued">
        A before/after comparison. Drag the divider or click anywhere on the picture, or Tab to it
        and use the arrow keys. Here the before picture is the after picture in grey.
      </Typography>
    </div>

    <div className="max-w-2xl">
      <CompareSlider after={after} before={before} isAdult={false} />
    </div>
  </div>
);

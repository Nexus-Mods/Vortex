/**
 * TypographyLink Demo Component
 * Demonstrates the TypographyLink component variants, appearances and icons
 */

import { mdiArrowRight, mdiOpenInNew } from "@mdi/js";
import React from "react";

import { Typography } from "./Typography";
import type { TypographyButtonProps } from "./TypographyLink";
import { TypographyLink } from "./TypographyLink";

const appearances: NonNullable<TypographyButtonProps["appearance"]>[] = [
  "info",
  "premium",
  "primary",
  "moderate",
  "strong",
  "subdued",
];

const variants: NonNullable<TypographyButtonProps["variant"]>[] = ["primary", "secondary", "none"];

export const TypographyLinkDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        TypographyLink
      </Typography>

      <Typography appearance="subdued">
        A button styled as a link with typography integration. Supports left/right icons, multiple
        appearances and variants.
      </Typography>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Variants
      </Typography>

      <div className="flex flex-wrap items-center gap-6">
        {variants.map((variant) => (
          <TypographyLink key={variant} variant={variant}>
            {variant}
          </TypographyLink>
        ))}
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Appearances
      </Typography>

      <div className="flex flex-wrap items-center gap-6">
        {appearances.map((appearance) => (
          <TypographyLink appearance={appearance} key={appearance}>
            {appearance}
          </TypographyLink>
        ))}
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        With Icons
      </Typography>

      <div className="flex flex-wrap items-center gap-6">
        <TypographyLink leftIconPath={mdiArrowRight}>Left icon</TypographyLink>

        <TypographyLink rightIconPath={mdiOpenInNew}>Right icon</TypographyLink>

        <TypographyLink leftIconPath={mdiArrowRight} rightIconPath={mdiOpenInNew}>
          Both icons
        </TypographyLink>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Typography Types
      </Typography>

      <div className="flex flex-wrap items-center gap-6">
        <TypographyLink typographyType="body-lg">body-lg</TypographyLink>

        <TypographyLink typographyType="body-md">body-md</TypographyLink>

        <TypographyLink typographyType="body-sm">body-sm</TypographyLink>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Disabled
      </Typography>

      <div className="flex flex-wrap items-center gap-6">
        <TypographyLink disabled>Disabled link</TypographyLink>
      </div>
    </div>
  </div>
);

/**
 * TypographyLink Demo Component
 * Demonstrates the TypographyLink component variants, appearances and icons
 */

import { mdiArrowRight, mdiOpenInNew } from "@mdi/js";
import React from "react";

import { Typography } from "./Typography";
import { TypographyLink, type ITypographyLinkProps } from "./TypographyLink";

// Brands sharing the standard solid ramp; `neutral` lives in a different
// prop-type arm so it gets its own row below.
const colourBrands = ["primary", "info", "success", "premium", "danger", "warning"] as const;
const appearances = ["weak", "subdued", "moderate", "strong"] as const;

const variants: NonNullable<ITypographyLinkProps["variant"]>[] = ["primary", "secondary", "none"];

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
        Colours (brand × appearance)
      </Typography>

      <div className="space-y-2">
        {/* neutral has the full ramp; render its row explicitly */}
        <div className="flex items-baseline gap-x-4">
          <Typography appearance="subdued" className="w-24 shrink-0" typographyType="body-sm">
            neutral
          </Typography>

          {appearances.map((appearance) => (
            <TypographyLink
              appearance={appearance}
              brand="neutral"
              key={appearance}
              typographyType="body-sm"
              variant="secondary"
            >
              {appearance}
            </TypographyLink>
          ))}
        </div>

        {colourBrands.map((brand) => (
          <div className="flex items-baseline gap-x-4" key={brand}>
            <Typography appearance="subdued" className="w-24 shrink-0" typographyType="body-sm">
              {brand}
            </Typography>

            {appearances.map((appearance) => (
              <TypographyLink
                appearance={appearance}
                brand={brand}
                key={appearance}
                typographyType="body-sm"
                variant="secondary"
              >
                {appearance}
              </TypographyLink>
            ))}
          </div>
        ))}

        <div className="flex items-baseline gap-x-4 rounded-sm bg-surface-high p-3">
          <Typography appearance="subdued" className="w-24 shrink-0" typographyType="body-sm">
            translucent
          </Typography>

          {appearances.map((appearance) => (
            <TypographyLink
              appearance={appearance}
              brand="neutral-translucent"
              key={appearance}
              typographyType="body-sm"
              variant="secondary"
            >
              {appearance}
            </TypographyLink>
          ))}
        </div>
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

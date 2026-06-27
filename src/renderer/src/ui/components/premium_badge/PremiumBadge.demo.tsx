/**
 * PremiumBadge Demo Component
 * Demonstrates the PremiumBadge component
 */

import React from "react";

import { Typography } from "@/ui/components/typography/Typography";

import { PremiumBadge } from "./PremiumBadge";

export const PremiumBadgeDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        PremiumBadge
      </Typography>

      <Typography appearance="subdued">
        An inline badge displaying a diamond icon on a premium background, used to denote premium
        content.
      </Typography>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Default
      </Typography>

      <PremiumBadge />
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Inline with text
      </Typography>

      <div className="flex items-center gap-2">
        <PremiumBadge />

        <Typography>Premium feature</Typography>
      </div>
    </div>
  </div>
);

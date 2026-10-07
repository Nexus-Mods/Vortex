/**
 * Badges Demo Component
 * Demonstrates the PremiumBadge and NexusBadge components
 */

import React from "react";

import { Typography } from "@/ui/components/typography/Typography";

import { NexusBadge } from "./nexus_badge/NexusBadge";
import { PremiumBadge } from "./premium_badge/PremiumBadge";

export const BadgesDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Badges
      </Typography>

      <Typography appearance="subdued">
        Small marks for what something is: a premium feature, or an action that goes to Nexus Mods.
      </Typography>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        PremiumBadge
      </Typography>

      <Typography appearance="subdued">
        A diamond icon on a premium background, used to denote premium content.
      </Typography>

      <div className="flex items-center gap-2">
        <PremiumBadge />

        <Typography>Premium feature</Typography>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        NexusBadge
      </Typography>

      <Typography appearance="subdued">
        The Nexus Mods logo in its own colours, which a single icon path can't draw. 16px by
        default; its className sizes it.
      </Typography>

      <div className="flex items-center gap-2">
        <NexusBadge />

        <Typography>Open on Nexus Mods</Typography>

        <NexusBadge className="ml-4 size-8" />
      </div>
    </div>
  </div>
);

/**
 * Bullet Demo Component
 * Demonstrates the Bullet component defaults and className overrides
 */

import React from "react";

import { Typography } from "../typography/Typography";
import { Bullet } from "./Bullet";

export const BulletDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Bullet
      </Typography>

      <Typography appearance="subdued">
        A small rotated-square dot used as an inline marker or separator. Defaults come from the
        `.nxm-bullet` class; pass `className` to override any of them (Tailwind utilities win over
        the defaults).
      </Typography>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Default
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        `size-0.75`, rotated 45°, translucent-subdued colour.
      </Typography>

      <Bullet />
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Overrides
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        Size and colour overridden via `className`.
      </Typography>

      <div className="flex items-center gap-6">
        <Bullet className="size-1 bg-neutral-subdued" />

        <Bullet className="size-2 bg-danger-strong" />
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Inline separator
      </Typography>

      <div className="flex items-center gap-x-2">
        <Typography appearance="moderate">Mod name</Typography>

        <Bullet />

        <Typography appearance="none" className="text-danger-strong" typographyType="body-sm">
          Adult
        </Typography>
      </div>
    </div>
  </div>
);

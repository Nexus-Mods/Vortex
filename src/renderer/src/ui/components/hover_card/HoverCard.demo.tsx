/**
 * HoverCard Demo Component
 * Demonstrates a mod's card with a picture, tinted in its colour, one without, and a
 * collection's, its cover beside its title
 */

import React from "react";

import { Typography } from "@/ui/components/typography/Typography";

import { HoverCard } from "./HoverCard";

/** What a card's footer holds: who made it and its size. */
const Footer = ({ author, size }: { author: string; size: string }) => (
  <>
    <span className="min-w-0 flex-1 truncate">{author}</span>

    <span className="shrink-0">{size}</span>
  </>
);

// A thumbnail-sized trigger, as a table row's.
const TRIGGER_CLASS = "flex h-10 items-center rounded-sm bg-surface-high px-3 text-body-sm";

export const HoverCardDemo = () => (
  <div className="space-y-4">
    <Typography appearance="subdued">
      Hover a trigger. The card opens after a longer delay than a tooltip.
    </Typography>

    <div className="flex gap-4">
      <HoverCard
        description="The horse overhaul you've been waiting for! Yes, that one."
        footer={<Footer author="tsptds" size="12.00 GB" />}
        image="https://picsum.photos/seed/mod/385/216"
        title="HorsePower - Modernized Horse Riding (Total Riding Overhaul)"
      >
        <span className={TRIGGER_CLASS}>With a picture</span>
      </HoverCard>

      <HoverCard
        description="Add 50 new radiant-quest enabled + 15 extra dungeons in game."
        footer={<Footer author="juhaantero68" size="1.20 GB" />}
        title="Forgotten Dungeons SSE"
      >
        <span className={TRIGGER_CLASS}>Without one</span>
      </HoverCard>

      <HoverCard
        description="Most endorsed collection ever. Perfect for your first collection experience."
        footer={<Footer author="canliberk" size="486 mods" />}
        image="https://picsum.photos/seed/collection/400/500"
        imageType="collection"
        title="Immersive & Adult"
      >
        <span className={TRIGGER_CLASS}>A collection</span>
      </HoverCard>
    </div>
  </div>
);

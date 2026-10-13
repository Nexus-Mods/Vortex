/**
 * HoverCard Demo Component
 * Demonstrates a card with a picture, tinted in its colour, and one without
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

// A thumbnail-sized trigger, as a table row's. An element, not a component, as the card
// holds its trigger by a ref to its DOM node.
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
    </div>
  </div>
);

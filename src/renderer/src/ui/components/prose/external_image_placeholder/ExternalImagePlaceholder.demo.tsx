/**
 * ExternalImagePlaceholder Demo Component
 * Demonstrates the placeholder for images from outside Nexus Mods, in each of its variants
 */

import React from "react";

import { Typography } from "@/ui/components/typography/Typography";

import { ExternalImagePlaceholder, type IExternalImage } from "./ExternalImagePlaceholder";

const WEBSITE_URL = "https://www.nexusmods.com/skyrimspecialedition/mods/3863";

const VARIANTS: Array<{ title: string; description: string; images: IExternalImage[] }> = [
  {
    title: "Standalone, with alt text",
    description: "The alt text is the headline, so the user knows what they're missing.",
    images: [{ host: "i.imgur.com", alt: "Lanterns of the North banner" }],
  },
  {
    title: "Standalone, without alt text",
    description: "The headline is External image, and the body starts at From.",
    images: [{ host: "i.imgur.com" }],
  },
  {
    title: "Two or more in a row",
    description: "One placeholder with a count, naming up to three hosts, then +N more.",
    images: [
      { host: "i.imgur.com" },
      { host: "imgsli.com" },
      { host: "i.postimg.cc" },
      { host: "cdn.discordapp.com" },
    ],
  },
  {
    title: "Linked, with alt text",
    description: "The link is labelled with the alt text, with the whole link on hover.",
    images: [{ host: "i.imgur.com", alt: "Join our Discord", href: "https://discord.gg/example" }],
  },
  {
    title: "Linked, without alt text",
    description: "The link is labelled with its domain.",
    images: [{ host: "i.imgur.com", href: "https://www.patreon.com/example" }],
  },
  {
    title: "Linked, two or more in a row",
    description: "Every image's link is listed.",
    images: [
      { host: "i.imgur.com", alt: "Join our Discord", href: "https://discord.gg/example" },
      { host: "imgsli.com", href: "https://www.patreon.com/example" },
      { host: "i.postimg.cc", href: "https://drive.google.com/example" },
      { host: "cdn.discordapp.com" },
      { host: "i.imgur.com" },
    ],
  },
];

export const ExternalImagePlaceholderDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        External image placeholder
      </Typography>

      <Typography appearance="subdued">
        Shown wherever a mod description embeds an image hosted outside Nexus Mods, which Vortex
        doesn't load. The variant is picked from its alt text, whether it's a link, and whether it
        sits next to other external images.
      </Typography>
    </div>

    {VARIANTS.map(({ title, description, images }) => (
      <div className="space-y-2" key={title}>
        <Typography as="h3" typographyType="heading-xs">
          {title}
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          {description}
        </Typography>

        <ExternalImagePlaceholder images={images} websiteUrl={WEBSITE_URL} />
      </div>
    ))}
  </div>
);

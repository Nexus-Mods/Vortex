/**
 * Prose Demo Component
 * Demonstrates each prose component: content written in BBCode, HTML, Markdown or plain text,
 * drawn in the app's prose styles, and the images, spoilers and placeholders they're made of
 */

import React, { type ReactNode } from "react";

import { Typography } from "@/ui/components/typography/Typography";

import { BBCode } from "./bbcode/BBCode";
import { ExternalImagePlaceholderDemo } from "./external_image_placeholder/ExternalImagePlaceholder.demo";
import { Html } from "./html/Html";
import { Markdown } from "./markdown/Markdown";
import { PlainText } from "./plain_text/PlainText";
import { ProseImage } from "./prose_image/ProseImage";
import { ProseSpoiler } from "./prose_spoiler/ProseSpoiler";

/** An image from Nexus Mods, which prose shows. */
const NEXUS_IMAGE = "https://staticdelivery.nexusmods.com/Images/games/4_3/tile_1704.jpg";

const WEBSITE_URL = "https://www.nexusmods.com/skyrimspecialedition/mods/3863";

const BBCODE = [
  "[size=4][b]Features[/b][/size]",
  "A [b]bold[/b], [i]slanted[/i] and [u]underlined[/u] word, and [url=https://www.nexusmods.com]a link[/url].",
  "[list]",
  "[*]A list item",
  "[*]Another, with [color=#e6a23c]colour[/color]",
  "[/list]",
  `[img width=200]${NEXUS_IMAGE}[/img]`,
  "[spoiler]Hidden until opened.[/spoiler]",
  '[img alt="Lanterns of the North banner"]https://i.imgur.com/banner.png[/img]',
  "Some text, then a run of screenshots:",
  "[img]https://i.imgur.com/a.png[/img]",
  "[img]https://imgsli.com/b.png[/img]",
  "[url=https://discord.gg/example][img]https://i.imgur.com/discord.png[/img][/url]",
].join("\n");

const HTML = `
  <h3>Release notes</h3>
  <p>Fixes a <strong>crash</strong> on start, and adds <a href="https://www.nexusmods.com">a link</a>.</p>
  <ul><li>One change</li><li>Another change</li></ul>
  <img src="${NEXUS_IMAGE}" width="200" alt="A Nexus Mods image" />
  <img src="https://i.imgur.com/left-out.png" alt="Left out, as it isn't from Nexus Mods" />
`;

const MARKDOWN = `
### Changelog

- **Fixed** a crash on start
- Added *more* things, and [a link](https://www.nexusmods.com)

\`inline code\` and an image:

![A Nexus Mods image](${NEXUS_IMAGE})
`;

const PLAIN_TEXT =
  "A changelog written without markup.\nIts line breaks are kept,\nand **this** isn't bold.";

/** One component's section: its name, what it's for, and examples. */
const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <div className="space-y-3">
    <Typography as="h3" typographyType="heading-xs">
      {title}
    </Typography>

    <Typography appearance="subdued" typographyType="body-sm">
      {description}
    </Typography>

    <div className="rounded-sm border border-stroke-weak p-4">{children}</div>
  </div>
);

export const ProseDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Prose
      </Typography>

      <Typography appearance="subdued">
        Content we don't write ourselves, such as mod descriptions and changelogs, drawn in the
        app's prose styles. Links open only if they go to a web page, and images show only if
        they're from Nexus Mods.
      </Typography>
    </div>

    <Section
      description="BBCode, as mod descriptions are written. With externalImagePlaceholders, images from outside Nexus Mods show as placeholders; without it they're left out."
      title="BBCode"
    >
      <BBCode bbcode={BBCODE} externalImagePlaceholders={{ websiteUrl: WEBSITE_URL }} />
    </Section>

    <Section
      description="Sanitised HTML, such as a GitHub release's notes. The image from outside Nexus Mods is left out."
      title="Html"
    >
      <Html html={HTML} />
    </Section>

    <Section description="Markdown, such as a changelog." title="Markdown">
      <Markdown markdown={MARKDOWN} />
    </Section>

    <Section
      description="Text without markup, its line breaks kept and nothing read as formatting."
      title="PlainText"
    >
      <PlainText text={PLAIN_TEXT} />
    </Section>

    <Section
      description="Prose hidden behind a button until opened, as BBCode's [spoiler]."
      title="ProseSpoiler"
    >
      <ProseSpoiler label="Show the spoiler">
        <PlainText text="Hidden until opened." />
      </ProseSpoiler>
    </Section>

    <Section
      description="An image in prose, at the size it's given or its own, aligned as asked. Only from Nexus Mods, unless any domain is allowed."
      title="ProseImage"
    >
      <div className="space-y-2">
        <ProseImage align="left" src={NEXUS_IMAGE} width={160} />
        <ProseImage align="center" src={NEXUS_IMAGE} width={160} />
        <ProseImage align="right" src={NEXUS_IMAGE} width={160} />
      </div>
    </Section>

    <ExternalImagePlaceholderDemo />
  </div>
);

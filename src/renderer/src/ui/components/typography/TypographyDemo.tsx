/**
 * Typography Demo Component
 * Demonstrates the Typography component variants and features
 */

import React from "react";

import { Typography } from "./Typography";

export const TypographyDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Typography
      </Typography>

      <Typography appearance="subdued">
        A consistent typography system with predefined sizes and appearances.
      </Typography>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Heading Styles
      </Typography>

      <div className="space-y-2">
        <Typography as="h1" typographyType="heading-2xl">
          heading-2xl: The quick brown fox
        </Typography>

        <Typography as="h2" typographyType="heading-xl">
          heading-xl: The quick brown fox
        </Typography>

        <Typography as="h3" typographyType="heading-lg">
          heading-lg: The quick brown fox
        </Typography>

        <Typography as="h4" typographyType="heading-md">
          heading-md: The quick brown fox
        </Typography>

        <Typography as="h5" typographyType="heading-sm">
          heading-sm: The quick brown fox
        </Typography>

        <Typography as="h6" typographyType="heading-xs">
          heading-xs: The quick brown fox
        </Typography>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Title Styles
      </Typography>

      <div className="space-y-2">
        <Typography as="p" typographyType="title-md">
          title-md: The quick brown fox
        </Typography>

        <Typography as="p" typographyType="title-sm">
          title-sm: The quick brown fox
        </Typography>

        <Typography as="p" typographyType="title-xs">
          title-xs: The quick brown fox
        </Typography>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Body Styles
      </Typography>

      <div className="space-y-2">
        <Typography as="p" typographyType="body-2xl">
          body-2xl: The quick brown fox
        </Typography>

        <Typography as="p" typographyType="body-xl">
          body-xl: The quick brown fox
        </Typography>

        <Typography as="p" typographyType="body-lg">
          body-lg: The quick brown fox
        </Typography>

        <Typography as="p">body-md: The quick brown fox</Typography>

        <Typography as="p" typographyType="body-sm">
          body-sm: The quick brown fox
        </Typography>

        <Typography as="p" typographyType="body-xs">
          body-xs: The quick brown fox
        </Typography>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Text Appearances
      </Typography>

      <div className="space-y-2">
        <Typography>
          <span className="font-semibold">Strong:</span> Strong text emphasis
        </Typography>

        <Typography appearance="moderate">
          <span className="font-semibold">Moderate:</span> Moderate text
          emphasis
        </Typography>

        <Typography appearance="subdued">
          <span className="font-semibold">Subdued:</span> Subdued text emphasis
        </Typography>

        <Typography appearance="weak">
          <span className="font-semibold">Weak:</span> Weak text emphasis
        </Typography>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Responsive Typography
      </Typography>

      <Typography
        appearance="moderate"
        typographyType={{
          default: "body-sm",
          md: "body-lg",
          lg: "body-2xl",
        }}
      >
        This text is responsive: body-sm on mobile, body-lg on tablets, body-2xl
        on desktop. Resize your window to see it change.
      </Typography>
    </div>
  </div>
);

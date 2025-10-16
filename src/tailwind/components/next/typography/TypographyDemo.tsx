/**
 * Typography Demo Component
 * Demonstrates the Typography component from the web team's "next" project
 */

import * as React from 'react';
import { Typography } from './Typography';

export const TypographyDemo: React.ComponentType = () => {
  return (
    <div className="tw:p-6">
      <Typography
        as="h1"
        typographyType="heading-2xl"
        appearance="strong"
        className="tw:mb-6"
      >
        🎨 Typography System from Web Team
      </Typography>

      <Typography
        as="p"
        typographyType="body-md"
        appearance="subdued"
        className="tw:mb-8"
      >
        This component is adapted from the web team's "next" project. It provides a consistent
        typography system with predefined sizes and appearances.
      </Typography>

      {/* Headings */}
      <div className="tw:mb-8">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="tw:mb-4"
        >
          Heading Styles
        </Typography>

        <div className="tw:space-y-2">
          <Typography as="h1" typographyType="heading-2xl">heading-2xl: The quick brown fox</Typography>
          <Typography as="h2" typographyType="heading-xl">heading-xl: The quick brown fox</Typography>
          <Typography as="h3" typographyType="heading-lg">heading-lg: The quick brown fox</Typography>
          <Typography as="h4" typographyType="heading-md">heading-md: The quick brown fox</Typography>
          <Typography as="h5" typographyType="heading-sm">heading-sm: The quick brown fox</Typography>
          <Typography as="h6" typographyType="heading-xs">heading-xs: The quick brown fox</Typography>
        </div>
      </div>

      {/* Titles */}
      <div className="tw:mb-8">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="tw:mb-4"
        >
          Title Styles
        </Typography>

        <div className="tw:space-y-2">
          <Typography as="p" typographyType="title-md">title-md: The quick brown fox</Typography>
          <Typography as="p" typographyType="title-sm">title-sm: The quick brown fox</Typography>
          <Typography as="p" typographyType="title-xs">title-xs: The quick brown fox</Typography>
        </div>
      </div>

      {/* Body */}
      <div className="tw:mb-8">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="tw:mb-4"
        >
          Body Styles
        </Typography>

        <div className="tw:space-y-2">
          <Typography as="p" typographyType="body-2xl">body-2xl: The quick brown fox</Typography>
          <Typography as="p" typographyType="body-xl">body-xl: The quick brown fox</Typography>
          <Typography as="p" typographyType="body-lg">body-lg: The quick brown fox</Typography>
          <Typography as="p" typographyType="body-md">body-md: The quick brown fox</Typography>
          <Typography as="p" typographyType="body-sm">body-sm: The quick brown fox</Typography>
          <Typography as="p" typographyType="body-xs">body-xs: The quick brown fox</Typography>
        </div>
      </div>

      {/* Appearances */}
      <div className="tw:mb-8">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="tw:mb-4"
        >
          Text Appearances
        </Typography>

        <div className="tw:space-y-2">
          <Typography as="p" appearance="strong">appearance="strong": Strong text emphasis</Typography>
          <Typography as="p" appearance="moderate">appearance="moderate": Moderate text emphasis</Typography>
          <Typography as="p" appearance="subdued">appearance="subdued": Subdued text emphasis</Typography>
          <Typography as="p" appearance="weak">appearance="weak": Weak text emphasis</Typography>
        </div>
      </div>

      {/* Responsive */}
      <div className="tw:mb-4 tw:p-4 tw:bg-blue-50 tw:rounded">
        <Typography
          as="p"
          typographyType={{
            default: 'body-sm',
            md: 'body-md',
            lg: 'body-lg',
          }}
          appearance="moderate"
        >
          📱 This text is responsive: body-sm on mobile, body-md on tablets, body-lg on desktop.
          Resize your window to see it change!
        </Typography>
      </div>
    </div>
  );
};

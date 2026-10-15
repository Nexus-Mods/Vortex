/**
 * Typography Demo Component
 * Demonstrates the Typography component variants and features
 */

import React from "react";

import { Typography } from "./Typography";

// Brands sharing the standard solid ramp. `neutral` and `neutral-translucent`
// live in a different prop-type arm (they also allow `inverted`), so they are
// rendered as their own rows below rather than mixed into this list.
const colourBrands = ["primary", "info", "success", "premium", "danger", "warning"] as const;
const appearances = ["weak", "subdued", "moderate", "strong"] as const;

const bodyTypes = ["body-2xl", "body-xl", "body-lg", "body-md", "body-sm", "body-xs"] as const;
const weights = [
  { label: "Normal", className: undefined },
  { label: "Medium", className: "font-medium" },
  { label: "Semi Bold", className: "font-semibold" },
] as const;

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
        Body Weights
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        Normal by default; font-medium or font-semibold for more weight.
      </Typography>

      <div className="space-y-2">
        {bodyTypes.map((type) => (
          <div className="flex items-baseline gap-x-6" key={type}>
            <Typography appearance="subdued" className="w-20 shrink-0" typographyType="body-sm">
              {type}
            </Typography>

            {weights.map(({ label, className }) => (
              <Typography className={className} key={label} typographyType={type}>
                {label}
              </Typography>
            ))}
          </div>
        ))}
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Colours (brand × appearance)
      </Typography>

      <div className="space-y-1">
        {/* neutral has the full ramp plus inverted; render its row explicitly */}
        <div className="flex items-baseline gap-x-4">
          <Typography appearance="subdued" className="w-28 shrink-0" typographyType="body-sm">
            neutral
          </Typography>

          {appearances.map((appearance) => (
            <Typography
              appearance={appearance}
              brand="neutral"
              key={appearance}
              typographyType="body-sm"
            >
              {appearance}
            </Typography>
          ))}
        </div>

        {colourBrands.map((brand) => (
          <div className="flex items-baseline gap-x-4" key={brand}>
            <Typography appearance="subdued" className="w-28 shrink-0" typographyType="body-sm">
              {brand}
            </Typography>

            {appearances.map((appearance) => (
              <Typography
                appearance={appearance}
                brand={brand}
                key={appearance}
                typographyType="body-sm"
              >
                {appearance}
              </Typography>
            ))}
          </div>
        ))}
      </div>

      {/* inverted only exists on neutral; shown on a light surface */}
      <div className="rounded-sm bg-surface-inverted p-3">
        <Typography appearance="inverted" brand="neutral">
          neutral + inverted (for use on light surfaces)
        </Typography>
      </div>

      {/* neutral-on-scrim draws from the fixed on-scrim ramp, so it is shown over one */}
      <div className="flex items-baseline gap-x-4 rounded-sm bg-scrim-800 p-3">
        <Typography appearance="subdued" className="w-28 shrink-0" typographyType="body-sm">
          on-scrim
        </Typography>

        {appearances.map((appearance) => (
          <Typography
            appearance={appearance}
            brand="neutral-on-scrim"
            key={appearance}
            typographyType="body-sm"
          >
            {appearance}
          </Typography>
        ))}
      </div>

      {/* neutral-translucent: the shared white-alpha translucent ramp, over a surface */}
      <div className="flex items-baseline gap-x-4 rounded-sm bg-surface-high p-3">
        <Typography appearance="subdued" className="w-28 shrink-0" typographyType="body-sm">
          translucent
        </Typography>

        {appearances.map((appearance) => (
          <Typography
            appearance={appearance}
            brand="neutral-translucent"
            key={appearance}
            typographyType="body-sm"
          >
            {appearance}
          </Typography>
        ))}
      </div>

      {/* brand="none" opts out of colour — inherits from the parent */}
      <div className="text-success-strong">
        <Typography brand="none">brand=&quot;none&quot; inherits the parent colour</Typography>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Wrapping Text
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        One Typography styles a block, and what&apos;s inside inherits it. Wrap a list or several
        paragraphs in one, with plain elements inside, rather than one per item.
      </Typography>

      <Typography as="ul" className="list-inside list-disc space-y-2">
        <li>A list item takes the list&apos;s style.</li>

        <li>So does every other one.</li>
      </Typography>

      <Typography as="div" className="space-y-2" typographyType="body-sm">
        <p>A paragraph takes its wrapper&apos;s style.</p>

        <p>
          {`So does the next, and a nested Typography changes it only where it differs, as for `}

          <Typography appearance="subdued" as="span" typographyType="inherit">
            this subdued phrase
          </Typography>

          {`, which keeps the wrapper's body-sm with typographyType="inherit" rather than resetting to body-md.`}
        </p>
      </Typography>
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
        This text is responsive: body-sm on mobile, body-lg on tablets, body-2xl on desktop. Resize
        your window to see it change.
      </Typography>
    </div>
  </div>
);

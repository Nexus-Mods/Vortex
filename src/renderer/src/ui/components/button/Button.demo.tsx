/**
 * Button Demo Component
 * Demonstrates the Button component variants and features
 */

import { mdiCheck, mdiChevronRight, mdiCog, mdiDownload } from "@mdi/js";
import React, { useState } from "react";

import { Typography } from "@/ui/components/typography/Typography";

import { Button, type IButtonAppearance, type IButtonBrand } from "./Button";

const BRANDS: IButtonBrand[] = ["primary", "info", "neutral", "success", "premium"];
const APPEARANCES: IButtonAppearance[] = ["strong", "moderate", "subdued", "weak"];

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const ButtonDemo = () => {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const handleLoadingClick = (key: string) => {
    setLoadingStates({ ...loadingStates, [key]: true });
    setTimeout(() => setLoadingStates({ ...loadingStates, [key]: false }), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          Button
        </Typography>

        <Typography appearance="subdued">
          A consistent button system with a brand × appearance matrix, multiple sizes, and states
          including icon support.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Brand × Appearance
        </Typography>

        {BRANDS.map((brand) => (
          <div className="space-y-2" key={brand}>
            <Typography appearance="subdued" typographyType="body-sm">
              {titleCase(brand)}
            </Typography>

            <div className="flex flex-wrap items-center gap-4">
              {APPEARANCES.map((appearance) => (
                <React.Fragment key={appearance}>
                  <Button appearance={appearance} brand={brand}>
                    {titleCase(appearance)}
                  </Button>

                  <Button
                    appearance={appearance}
                    aria-label={`${titleCase(brand)} ${titleCase(appearance)} icon only`}
                    brand={brand}
                    leftIconPath={mdiCog}
                  />
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Sizes
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button size="md">Medium</Button>

          <Button size="sm">Small</Button>

          <Button size="xs">Extra Small</Button>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          States
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button disabled={true}>Disabled</Button>

          <Button isLoading={loadingStates.primary} onClick={() => handleLoadingClick("primary")}>
            Click for Loading
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Custom Content
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            customContent={
              <span className="flex items-center gap-2">
                <span>Custom Content Button</span>
              </span>
            }
          />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Buttons with Icons
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button leftIconPath={mdiDownload}>Download</Button>

          <Button brand="neutral" appearance="subdued" rightIconPath={mdiChevronRight}>
            Next
          </Button>

          <Button brand="success" leftIconPath={mdiCheck} size="sm">
            Confirm
          </Button>

          <Button brand="neutral" appearance="weak" leftIconPath={mdiCog}>
            Settings
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Icon Only
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Buttons with an icon and no label collapse to a square. Always provide an aria-label.
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          {APPEARANCES.map((appearance) => (
            <Button
              appearance={appearance}
              aria-label={`Settings (${appearance})`}
              key={appearance}
              leftIconPath={mdiCog}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button aria-label="Settings (md)" leftIconPath={mdiCog} size="md" />

          <Button aria-label="Settings (sm)" leftIconPath={mdiCog} size="sm" />

          <Button aria-label="Settings (xs)" leftIconPath={mdiCog} size="xs" />
        </div>
      </div>
    </div>
  );
};

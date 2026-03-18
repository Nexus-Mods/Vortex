/**
 * Button Demo Component
 * Demonstrates the Button component variants and features
 */

import { mdiCheck, mdiChevronRight, mdiCog, mdiDownload } from "@mdi/js";
import React, { useState } from "react";

import { Typography } from "../typography/Typography";
import { Button } from "./Button";

export const ButtonDemo = () => {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {},
  );

  const handleLoadingClick = (key: string) => {
    setLoadingStates({ ...loadingStates, [key]: true });
    setTimeout(
      () => setLoadingStates({ ...loadingStates, [key]: false }),
      2000,
    );
  };

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          Button
        </Typography>

        <Typography appearance="subdued">
          A consistent button system with multiple types, sizes, and states
          including icon support.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Primary Buttons
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button>Primary Medium</Button>

          <Button size="sm">Primary Small</Button>

          <Button disabled={true}>Disabled</Button>

          <Button
            isLoading={loadingStates.primary}
            onClick={() => handleLoadingClick("primary")}
          >
            Click for Loading
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Secondary Buttons
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button buttonType="secondary">Secondary Medium</Button>

          <Button buttonType="secondary" size="sm">
            Secondary Small
          </Button>

          <Button buttonType="secondary" filled="strong">
            Filled Strong
          </Button>

          <Button buttonType="secondary" filled="weak">
            Filled Weak
          </Button>

          <Button buttonType="secondary" disabled={true}>
            Disabled
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Tertiary Buttons
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button buttonType="tertiary">Tertiary Medium</Button>

          <Button buttonType="tertiary" size="sm">
            Tertiary Small
          </Button>

          <Button buttonType="tertiary" filled="strong">
            Filled Strong
          </Button>

          <Button buttonType="tertiary" filled="weak">
            Filled Weak
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Success Buttons
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button buttonType="success">Success Medium</Button>

          <Button buttonType="success" size="sm">
            Success Small
          </Button>

          <Button buttonType="success" disabled={true}>
            Disabled
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Premium Buttons
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button buttonType="premium">Premium Medium</Button>

          <Button buttonType="premium" size="sm">
            Premium Small
          </Button>

          <Button buttonType="premium" disabled={true}>
            Disabled
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
          Responsive Buttons
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          These buttons change size based on screen width. Try resizing the
          window!
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm">Responsive (sm on mobile, md on desktop)</Button>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Buttons with Icons
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button leftIconPath={mdiDownload}>Download</Button>

          <Button buttonType="secondary" rightIconPath={mdiChevronRight}>
            Next
          </Button>

          <Button buttonType="success" leftIconPath={mdiCheck} size="sm">
            Confirm
          </Button>

          <Button buttonType="tertiary" leftIconPath={mdiCog}>
            Settings
          </Button>
        </div>
      </div>
    </div>
  );
};
